import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'
import type { BeautifyStatus, ToolInstallStatus } from '@shared/types/beautify'

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
export async function installTranslucentTB(): Promise<void> {
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

  await runScript('beautify', 'Install-TranslucentTB.ps1', args)
}

/** 安装 Winstep Nexus（写操作：离线 exe 静默安装 + 导入 .reg 配置） */
export async function installNexus(): Promise<void> {
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

  await runScript('beautify', 'Install-Nexus.ps1', args)
}

/**
 * 应用风格包（写操作）。本期落地「壁纸 + TranslucentTB 配置」组合：
 *   resources/themes/<themeId>/ 下约定放壁纸图片与 translucenttb.json。
 * 图标、Dock 布局等复杂项后续迭代。themeId 做白名单校验。
 */
export async function applyTheme(themeId: string): Promise<void> {
  if (!THEME_WHITELIST.includes(themeId as (typeof THEME_WHITELIST)[number])) {
    throw new Error(`不支持的风格包：${themeId}（允许：${THEME_WHITELIST.join(' / ')}）`)
  }

  const themeDir = join(getResourcesRoot(), 'themes', themeId)
  if (!existsSync(themeDir)) {
    throw new Error(`风格包资源缺失：${themeDir}（请放置壁纸与 translucenttb.json）`)
  }

  const wallpaper = findFileByExt(themeDir, ['.jpg', '.jpeg', '.png', '.bmp'])
  const ttbConfig =
    findFileByName(themeDir, 'translucenttb.json') ?? findFileByName(themeDir, 'settings.json')

  if (!wallpaper && !ttbConfig) {
    throw new Error(`风格包 ${themeId} 未包含可应用的资源（壁纸或 translucenttb.json）`)
  }

  // 应用壁纸（复用 wallpaper 模块脚本，脚本内先备份桌面注册表）
  if (wallpaper) {
    await runScript(
      'wallpaper',
      'Set-StaticWallpaper.ps1',
      ['-Path', wallpaper, '-Style', 'fill', '-BackupDir', getBackupDir()],
      60000,
    )
  }

  // 导入任务栏样式（脚本内先备份现有 TranslucentTB 配置）
  if (ttbConfig) {
    await runScript('beautify', 'Import-TranslucentTBConfig.ps1', [
      '-ConfigSource',
      ttbConfig,
      '-BackupDir',
      getBackupDir(),
    ])
  }

  writeConfig({ currentThemeId: themeId })
}
