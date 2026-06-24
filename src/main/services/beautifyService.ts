import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import type {
  ApplyThemeResult,
  BeautifyStatus,
  NexusConfigImportResult,
  NexusDeployResult,
  NexusDeployTargetToken,
  NexusInstallResult,
  ThemeStepResult,
  ToolInstallStatus,
} from '@shared/types/beautify'
import { buildNexusDeployManifest, pickNexusConfigSource } from '@shared/types/beautify'

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
 *   - 系统操作走 PowerShell 脚本（scripts/beautify/，应用壁纸复用 scripts/wallpaper/）。
 *   - 安装优先「离线纯软」：从 resources/themes/<tool>/ 读取离线安装器；
 *     缺失时返回指引性错误（TranslucentTB 预留 winget 兜底，Nexus 无官方 winget 包）。
 *   - 写操作（导入配置 / 应用壁纸）前在脚本内 reg export / 文件备份。
 *   - themeId 等参数在本层做白名单校验，防注入/越权。
 */

const execFileAsync = promisify(execFile)

/** 支持的风格包白名单（赛博 / 简约 / 电竞） */
const THEME_WHITELIST = ['cyber', 'minimal', 'esports'] as const

type ThemeId = (typeof THEME_WHITELIST)[number]

/** themeId 白名单校验（防注入 / 越权拼路径）；非法直接抛错。 */
function assertThemeId(themeId: string): asserts themeId is ThemeId {
  if (!THEME_WHITELIST.includes(themeId as ThemeId)) {
    throw new Error(`不支持的风格包：${themeId}（允许：${THEME_WHITELIST.join(' / ')}）`)
  }
}

/** 把未知异常转成可读中文消息（主进程无 renderer 的 errorMessage 工具） */
function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** 脚本通用返回结构 */
interface ScriptResult {
  ok: boolean
  data?: unknown
  code?: string
  message?: string
}

/** 应用配置（与 wallpaperService 共用同一文件，各管各的字段） */
interface WtConfig {
  currentThemeId?: string | null
  currentWallpaperId?: string | null
}

function getWtDir(): string {
  return join(app.getPath('appData'), 'WinTunerPro')
}

function getBackupDir(): string {
  return join(getWtDir(), 'backups')
}

function getConfigFile(): string {
  return join(getWtDir(), 'config.json')
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

function readConfig(): WtConfig {
  try {
    return JSON.parse(readFileSync(getConfigFile(), 'utf-8')) as WtConfig
  } catch {
    return {}
  }
}

function writeConfig(patch: Partial<WtConfig>): void {
  const next = { ...readConfig(), ...patch }
  mkdirSync(dirname(getConfigFile()), { recursive: true })
  writeFileSync(getConfigFile(), JSON.stringify(next, null, 2), 'utf-8')
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

/** 读取美化工具与风格包状态（只读） */
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
    currentThemeId: readConfig().currentThemeId ?? null,
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

/**
 * 导入指定风格包的 Nexus 预置配置（写操作，与「安装」解耦）。
 *
 * 约定资源位置：resources/themes/<themeId>/nexus.reg 或 nexus.wbk（两者均无返回 null，
 * 调用方按「跳过」处理，不报错）。统一入口 Import-NexusConfig.ps1 按扩展名分流（底层同源）：
 *   - .reg：检测已安装 → 停进程 → 备份 HKCU\Software\WinSTEP2000 → reg import → 重启（最稳，优先）。
 *   - .wbk：解析 INI 段 → 映射注册表写入。⚠ [DOCKS] 落点未上机验证 → 默认 -DryRun（仅预演不写入）。
 * 路径由本层用受控的 themeId 拼装，渲染进程不得传任意路径。
 *
 * 本函数对外导出，便于后续（P1）「重新应用预设」独立入口直接复用，无需改脚本。
 */
export async function importNexusConfig(themeId: string): Promise<NexusConfigImportResult | null> {
  assertThemeId(themeId)
  const themeDir = join(getResourcesRoot(), 'themes', themeId)
  if (!existsSync(themeDir)) return null

  // 仅在 nexus.reg / nexus.wbk 中按「reg 优先」分流，避免误选风格包内其它 .reg。
  const candidates = readdirSync(themeDir).filter((f) => /^nexus\.(reg|wbk)$/i.test(f))
  const picked = pickNexusConfigSource(candidates)
  if (!picked) return null

  const source = join(themeDir, picked.fileName)
  const args = ['-ConfigSource', source, '-BackupDir', getBackupDir()]
  // .wbk 的 [DOCKS] 落点尚未上机验证：默认 DryRun，仅预演不写入注册表（项目安全硬规则）。
  if (picked.format === 'wbk') args.push('-DryRun')

  // Nexus 导入涉及停止/重启进程与注册表写入，耗时短，给 2 分钟超时
  return runScript<NexusConfigImportResult>('beautify', 'Import-NexusConfig.ps1', args, 120000)
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

/**
 * 铺设指定风格包的 Nexus 离线资源（写操作）。
 *
 * 约定资源位置：resources/themes/<themeId>/nexus/<source>/（source 见 NEXUS_DEPLOY_CONVENTION：
 * theme / icons / shortcuts）。目录不存在或无可铺设子目录时返回 null（调用方按「无资源」处理）。
 * 资源清单组装为纯逻辑（buildNexusDeployManifest），本层把每条映射解析成绝对路径后交脚本铺设。
 * 脚本覆盖目标同名文件前先备份（项目安全硬规则）。
 *
 * 因 .wbk/.reg 预设以绝对路径引用资源，applyTheme 中应「先铺资源、再导入注册表配置」。
 */
export async function deployNexusResources(themeId: string): Promise<NexusDeployResult | null> {
  assertThemeId(themeId)
  const nexusDir = join(getResourcesRoot(), 'themes', themeId, 'nexus')
  if (!existsSync(nexusDir)) return null

  const subdirs = readdirSync(nexusDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
  const manifest = buildNexusDeployManifest(subdirs)
  if (manifest.length === 0) return null

  const resolved = manifest.map((e) => ({
    source: join(nexusDir, e.source),
    target: resolveDeployTarget(e.target),
  }))

  return runScript<NexusDeployResult>(
    'beautify',
    'Deploy-NexusResources.ps1',
    ['-ManifestJson', JSON.stringify(resolved), '-BackupDir', getBackupDir()],
    120000,
  )
}

/** Nexus UI 对齐预设目录与唯一预设源文件（以这份 .wbk 备份为准对齐 UI 设置）。 */
const NEXUS_PRESET_DIR = 'nexus'
const NEXUS_PRESET_WBK = 'wsbackup.wbk'

/**
 * 以 `resources/themes/nexus/wsbackup.wbk` 为唯一预设源，把一份 .wbk 备份的「UI 设置」
 * 对齐到本机（写操作，与风格包 applyTheme 解耦的独立入口）。
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

/**
 * 应用风格包（写操作）。落地「壁纸 + TranslucentTB 任务栏 + Nexus Dock」三件套组合：
 *   resources/themes/<themeId>/ 下约定放壁纸图片、translucenttb.json、nexus.reg（均为可选）。
 *
 * 设计要点：
 *   - themeId 白名单校验，防注入 / 越权拼路径。
 *   - 三个子项相互独立：单项失败不中断其余子项，分别记 applied/skipped/failed 返回（供 UI 分项标注）。
 *   - Dock 缺失（无 nexus.reg|.wbk、无 nexus/ 资源目录）时跳过；存在时先铺资源、再导入配置（脚本内先备份、可回滚）。
 *   - 只要有任一子项成功就记录 currentThemeId；三项资源全缺才抛错。
 */
export async function applyTheme(themeId: string): Promise<ApplyThemeResult> {
  assertThemeId(themeId)

  const themeDir = join(getResourcesRoot(), 'themes', themeId)
  if (!existsSync(themeDir)) {
    throw new Error(`风格包资源缺失：${themeDir}（请放置壁纸 / translucenttb.json / nexus.reg）`)
  }

  const wallpaper = findFileByExt(themeDir, ['.jpg', '.jpeg', '.png', '.bmp'])
  const ttbConfig =
    findFileByName(themeDir, 'translucenttb.json') ?? findFileByName(themeDir, 'settings.json')
  // Dock 资源：注册表预设（nexus.reg / nexus.wbk）或离线资源目录（nexus/）任一存在即联动。
  const nexusConfig = pickNexusConfigSource(
    existsSync(themeDir) ? readdirSync(themeDir).filter((f) => /^nexus\.(reg|wbk)$/i.test(f)) : [],
  )
  const hasNexusResources = existsSync(join(themeDir, 'nexus'))
  const hasDock = Boolean(nexusConfig) || hasNexusResources

  if (!wallpaper && !ttbConfig && !hasDock) {
    throw new Error(
      `风格包 ${themeId} 未包含可应用的资源（壁纸 / translucenttb.json / nexus.reg|.wbk / nexus/）`,
    )
  }

  const result: ApplyThemeResult = {
    themeId,
    wallpaper: { status: 'skipped', message: '风格包未包含壁纸' },
    taskbar: { status: 'skipped', message: '风格包未包含任务栏配置' },
    dock: { status: 'skipped', message: '风格包未包含 Dock 配置' },
  }

  // 壁纸（复用 wallpaper 模块脚本，脚本内先备份桌面注册表）
  if (wallpaper) {
    result.wallpaper = await runStep(() =>
      runScript(
        'wallpaper',
        'Set-StaticWallpaper.ps1',
        ['-Path', wallpaper, '-Style', 'fill', '-BackupDir', getBackupDir()],
        60000,
      ),
    )
  }

  // 任务栏样式（脚本内先备份现有 TranslucentTB 配置）
  if (ttbConfig) {
    result.taskbar = await runStep(() =>
      runScript('beautify', 'Import-TranslucentTBConfig.ps1', [
        '-ConfigSource',
        ttbConfig,
        '-BackupDir',
        getBackupDir(),
      ]),
    )
  }

  // Dock：联动 Nexus。顺序关键——先铺资源（注册表预设以绝对路径引用主题位图/图标/快捷方式，
  // 必须先存在），再导入注册表配置（脚本内均先备份、可回滚）。
  if (hasDock) {
    result.dock = await applyDockStep(themeId)
  }

  const anyApplied = [result.wallpaper, result.taskbar, result.dock].some(
    (s) => s.status === 'applied',
  )
  if (anyApplied) {
    writeConfig({ currentThemeId: themeId })
  }
  return result
}

/**
 * 应用 Dock 子项：先铺离线资源、再导入注册表配置（顺序关键，见 applyTheme 注释）。
 *   - 资源与配置均无 → skipped；
 *   - .wbk 走 DryRun（[DOCKS] 落点未上机验证）→ skipped，文案说明「已预演未写入」，避免误报已应用；
 *   - 其余成功 → applied；任一步抛错 → failed（不向外冒泡，保证壁纸/任务栏子项继续）。
 */
async function applyDockStep(themeId: string): Promise<ThemeStepResult> {
  try {
    const deployed = await deployNexusResources(themeId)
    const imported = await importNexusConfig(themeId)
    if (!deployed && !imported) {
      return { status: 'skipped', message: '风格包未包含 Dock 资源 / 配置' }
    }
    if (imported?.dryRun) {
      return {
        status: 'skipped',
        message:
          '检测到 .wbk 预设：[DOCKS] 落点尚未上机验证，已预演通过但未写入注册表（上机核对后去掉 DryRun 即生效）',
      }
    }
    return { status: 'applied' }
  } catch (err) {
    return { status: 'failed', message: toErrorMessage(err) }
  }
}

/** 执行单个风格包子项：成功→applied；抛错→failed（捕获错误信息，不向外冒泡，保证其余子项继续）。 */
async function runStep(fn: () => Promise<unknown>): Promise<ThemeStepResult> {
  try {
    await fn()
    return { status: 'applied' }
  } catch (err) {
    return { status: 'failed', message: toErrorMessage(err) }
  }
}
