import { execFile, spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import type {
  BeautifyStatus,
  NexusConfigImportResult,
  NexusDeployResult,
  NexusDeployTargetToken,
  NexusInstallResult,
  ToolInstallStatus,
} from '@shared/types/beautify'
import { buildNexusDeployManifest } from '@shared/types/beautify'

/** 安装过程进度回调的载荷（不含 tool；tool 由 IPC 处理器补齐后推送渲染进程） */
export interface InstallProgressUpdate {
  percent: number
  stage: string
}

/** 安装进度回调签名 */
export type InstallProgressCb = (p: InstallProgressUpdate) => void

/**
 * beautify 模块业务服务（真实实现）。
 *
 * 设计要点（见 code-organization.mdc）：
 *   - 系统操作走 PowerShell 脚本（scripts/beautify/）。
 *   - 安装优先「离线纯软」：从 resources/themes/<tool>/ 读取离线安装器；
 *     缺失时返回指引性错误（TranslucentTB 预留 winget 兜底，Nexus 无官方 winget 包）。
 *   - 写操作（导入配置 / 应用 Nexus UI 预设）前在脚本内 reg export / 文件备份。
 */

const execFileAsync = promisify(execFile)

/** 脚本通用返回结构 */
interface ScriptResult {
  ok: boolean
  data?: unknown
  code?: string
  message?: string
}

function getWtDir(): string {
  return join(app.getPath('appData'), 'WinTunerPro')
}

function getBackupDir(): string {
  return join(getWtDir(), 'backups')
}

/** 脚本根目录：打包态需 electron-builder extraResources 携带 scripts/ */
function getScriptsRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'scripts') : join(app.getAppPath(), 'scripts')
}

/** 离线资源根目录：打包态需 extraResources 携带 resources/ */
function getResourcesRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
}

function parseScriptResult(stdout: string): ScriptResult {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('{')) {
      try {
        return JSON.parse(lines[i]) as ScriptResult
      } catch {
        // 继续向上查找
      }
    }
  }
  throw new Error('无法解析脚本输出（未找到 JSON 结果）')
}

/**
 * 调用指定模块（beautify / wallpaper）下的 PowerShell 脚本。
 * 安装类脚本耗时较长，默认超时给到 3 分钟。
 */
async function runScript<T>(
  moduleDir: 'beautify' | 'wallpaper',
  scriptName: string,
  args: string[] = [],
  timeoutMs = 180000,
): Promise<T> {
  const scriptPath = join(getScriptsRoot(), moduleDir, scriptName)
  if (!existsSync(scriptPath)) {
    throw new Error(`脚本缺失：${scriptName}（预期位置 ${scriptPath}）`)
  }

  let stdout: string
  try {
    const res = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
    )
    stdout = res.stdout
  } catch (err) {
    const e = err as { killed?: boolean; stdout?: string; message?: string }
    if (e.killed) throw new Error(`脚本执行超时：${scriptName}`)
    stdout = e.stdout ?? ''
    if (!stdout) throw new Error(`脚本执行失败：${scriptName} - ${e.message ?? '未知错误'}`)
  }

  const parsed = parseScriptResult(stdout)
  if (!parsed.ok) {
    throw new Error(`[${parsed.code ?? 'ERR'}] ${parsed.message ?? '脚本返回失败'}`)
  }
  return parsed.data as T
}

/**
 * 流式调用 PowerShell 脚本（spawn 取代 execFile），实时捕获进度。
 *
 * 约定：脚本以 `WT_PROGRESS:{json}` 开头的行输出进度（json 含 percent/stage），
 * 经 onProgress 实时回调；其余以 `{` 开头的行作为最终结果，沿用「取最后一个可解析
 * JSON」逻辑。保留超时、-NoProfile -NonInteractive -ExecutionPolicy Bypass -File 等价行为；
 * 失败/超时抛可读中文错误。
 */
function runScriptStreaming<T>(
  moduleDir: 'beautify' | 'wallpaper',
  scriptName: string,
  args: string[] = [],
  onProgress?: InstallProgressCb,
  timeoutMs = 180000,
): Promise<T> {
  const scriptPath = join(getScriptsRoot(), moduleDir, scriptName)
  if (!existsSync(scriptPath)) {
    return Promise.reject(new Error(`脚本缺失：${scriptName}（预期位置 ${scriptPath}）`))
  }

  return new Promise<T>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
      { windowsHide: true },
    )

    // 结果候选行（非进度行）累积，交由 parseScriptResult 取最后一个可解析 JSON
    let resultText = ''
    let stderrText = ''
    let lineBuffer = ''
    let settled = false
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    const handleLine = (raw: string): void => {
      const line = raw.replace(/^\uFEFF/, '')
      const trimmed = line.trim()
      if (!trimmed) return
      if (trimmed.startsWith('WT_PROGRESS:')) {
        const jsonText = trimmed.slice('WT_PROGRESS:'.length)
        try {
          const p = JSON.parse(jsonText) as Partial<InstallProgressUpdate>
          onProgress?.({ percent: Number(p.percent) || 0, stage: String(p.stage ?? '') })
        } catch {
          // 忽略无法解析的进度行，不影响最终结果
        }
        return
      }
      resultText += `${line}\n`
    }

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      lineBuffer += chunk
      let idx: number
      while ((idx = lineBuffer.indexOf('\n')) >= 0) {
        handleLine(lineBuffer.slice(0, idx))
        lineBuffer = lineBuffer.slice(idx + 1)
      }
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderrText += chunk
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`脚本执行失败：${scriptName} - ${err.message}`))
    })

    child.on('close', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (lineBuffer) handleLine(lineBuffer)

      if (timedOut) {
        reject(new Error(`脚本执行超时：${scriptName}`))
        return
      }

      let parsed: ScriptResult
      try {
        parsed = parseScriptResult(resultText)
      } catch (e) {
        const detail = stderrText.trim()
        reject(
          new Error(
            resultText.trim()
              ? (e as Error).message
              : `脚本执行失败：${scriptName}${detail ? ` - ${detail}` : ''}`,
          ),
        )
        return
      }
      if (!parsed.ok) {
        reject(new Error(`[${parsed.code ?? 'ERR'}] ${parsed.message ?? '脚本返回失败'}`))
        return
      }
      resolve(parsed.data as T)
    })
  })
}

/** 在目录中按扩展名查找第一个匹配的文件，返回绝对路径或 null */
function findFileByExt(dir: string, exts: string[]): string | null {
  if (!existsSync(dir)) return null
  const match = readdirSync(dir).find((f) => exts.includes(extname(f).toLowerCase()))
  return match ? join(dir, match) : null
}

/** 在目录中查找指定文件名（不存在返回 null） */
function findFileByName(dir: string, name: string): string | null {
  const p = join(dir, name)
  return existsSync(p) ? p : null
}

/** Get-BeautifyStatus.ps1 的 data 结构 */
interface BeautifyStatusScriptData {
  translucenttb: ToolInstallStatus
  nexus: ToolInstallStatus
}

/** 读取美化工具状态（只读） */
export async function getBeautifyStatus(): Promise<BeautifyStatus> {
  const data = await runScript<BeautifyStatusScriptData>(
    'beautify',
    'Get-BeautifyStatus.ps1',
    [],
    30000,
  )
  return {
    translucenttb: data.translucenttb,
    nexus: data.nexus,
  }
}

/** 安装 TranslucentTB（写操作：优先离线 msix，缺失则 winget 兜底；并导入预置配置） */
export async function installTranslucentTB(onProgress?: InstallProgressCb): Promise<void> {
  onProgress?.({ percent: 2, stage: '准备安装环境' })
  const toolDir = join(getResourcesRoot(), 'themes', 'translucenttb')
  const installer = findFileByExt(toolDir, ['.msix', '.msixbundle', '.appx', '.exe'])
  const config = findFileByName(toolDir, 'settings.json')

  const args: string[] = ['-BackupDir', getBackupDir()]
  if (installer) {
    args.push('-InstallerPath', installer)
  } else {
    // 离线包缺失时允许 winget 兜底（脚本内再判断 winget 是否可用）
    args.push('-UseWinget')
  }
  if (config) {
    args.push('-ConfigSource', config)
  }

  await runScriptStreaming('beautify', 'Install-TranslucentTB.ps1', args, onProgress)
  onProgress?.({ percent: 100, stage: '安装完成' })
}

/** 安装 Winstep Nexus（写操作：离线 exe 静默安装 + 导入 .reg 配置） */
export async function installNexus(onProgress?: InstallProgressCb): Promise<NexusInstallResult> {
  onProgress?.({ percent: 2, stage: '准备安装环境' })
  const toolDir = join(getResourcesRoot(), 'themes', 'nexus')
  const installer = findFileByExt(toolDir, ['.exe'])
  if (!installer) {
    throw new Error(
      '未找到 Winstep Nexus 离线安装包，请将安装 exe 放入 resources/themes/nexus/ 后重试。',
    )
  }
  const config = findFileByExt(toolDir, ['.reg'])

  const args: string[] = ['-InstallerPath', installer, '-BackupDir', getBackupDir()]
  if (config) {
    args.push('-ConfigSource', config)
  }

  const result = await runScriptStreaming<NexusInstallResult>(
    'beautify',
    'Install-Nexus.ps1',
    args,
    onProgress,
  )
  onProgress?.({ percent: 100, stage: '安装完成' })
  return result
}

/** 把资源铺设落点 token 解析为本机绝对路径（%PUBLIC% 缺省兜底 C:\Users\Public）。 */
function resolveDeployTarget(token: NexusDeployTargetToken): string {
  const pub = process.env.PUBLIC || 'C:\\Users\\Public'
  switch (token) {
    case 'PUBLIC_WINSTEP_THEMES':
      return join(pub, 'Documents', 'WinStep', 'Themes')
    case 'PUBLIC_WINSTEP_ICONS':
      return join(pub, 'Documents', 'WinStep', 'Icons')
  }
}

/** Nexus UI 对齐预设目录与唯一预设源文件（以这份 .wbk 备份为准对齐 UI 设置）。 */
const NEXUS_PRESET_DIR = 'nexus'
const NEXUS_PRESET_WBK = 'wsbackup.wbk'

/**
 * 以 `resources/themes/nexus/wsbackup.wbk` 为唯一预设源，把一份 .wbk 备份的「UI 设置」
 * 对齐到本机（写操作，独立入口）。
 *
 * 行为（严格对应需求「完全按 wbk 对齐 UI、但忽略快捷方式」）：
 *   1. 先铺设 UI 外观必需资源（theme / icons），绝不铺 shortcuts——
 *      shortcuts 已从 NEXUS_DEPLOY_CONVENTION 移除，故 buildNexusDeployManifest 天然不会产出。
 *      wbk 以绝对路径引用主题位图（如 Windows10Nx / NxBack.png），目标机缺该主题会导致外观对不齐，
 *      因此 theme/icons 若随包存在则铺设；缺失则跳过（不报错）。
 *   2. 再导入 .wbk：底层 Get-NexusBackupRegPlan 已过滤掉「快捷方式 / Dock 图标条目项」，
 *      仅对齐 UI 设置；返回 writtenCount / skippedShortcutCount 便于核对。
 *   ⚠ [DOCKS] 段落点（HKCU\Software\WinSTEP2000\NeXuS）尚未上机验证 → 默认 -DryRun（仅预演不写入）。
 *     在装有 Nexus 的机器上 GUI 恢复后 diff 注册表确认无误，再去掉 DryRun 真实写入。
 *
 * 预设源缺失（resources 离线包未铺设）时返回 null，调用方按「无预设」处理，不报错。
 */
export async function applyNexusUiPreset(): Promise<NexusConfigImportResult | null> {
  const presetDir = join(getResourcesRoot(), 'themes', NEXUS_PRESET_DIR)
  const source = join(presetDir, NEXUS_PRESET_WBK)
  if (!existsSync(source)) return null

  // 先铺 UI 外观资源（theme/icons），绝不铺 shortcuts（约定表已移除快捷方式落点）。
  const subdirs = existsSync(presetDir)
    ? readdirSync(presetDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : []
  const manifest = buildNexusDeployManifest(subdirs)
  if (manifest.length > 0) {
    const resolved = manifest.map((e) => ({
      source: join(presetDir, e.source),
      target: resolveDeployTarget(e.target),
    }))
    await runScript<NexusDeployResult>(
      'beautify',
      'Deploy-NexusResources.ps1',
      ['-ManifestJson', JSON.stringify(resolved), '-BackupDir', getBackupDir()],
      120000,
    )
  }

  // 以 wbk 为唯一预设源对齐 UI；[DOCKS] 落点未上机验证 → 默认 DryRun（项目安全硬规则）。
  return runScript<NexusConfigImportResult>(
    'beautify',
    'Import-NexusConfig.ps1',
    ['-ConfigSource', source, '-BackupDir', getBackupDir(), '-DryRun'],
    120000,
  )
}
