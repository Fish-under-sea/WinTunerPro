import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { app, shell } from 'electron'
import type { WallpaperState, WallpaperItem, WallpaperEngineStatus } from '@shared/types/wallpaper'

/**
 * wallpaper 模块业务服务（真实实现）。
 *
 * 设计要点（见 code-organization.mdc）：
 *   - 系统操作一律走 PowerShell 脚本（scripts/wallpaper/），主进程仅做参数校验 + 调度 + 解析。
 *   - 脚本统一输出 {ok,data|code,message} 单行 JSON，本层解析后映射成 shared 类型。
 *   - 静态壁纸为系统原生设置（SystemParametersInfo + 注册表），零后台驻留。
 *   - 动态壁纸走 Steam 的 Wallpaper Engine（appid 431960），仅检测 + 引导安装，不自实现渲染。
 *   - 写操作前在脚本内 reg export 备份；路径/参数做白名单与存在性校验防注入。
 */

const execFileAsync = promisify(execFile)

/** Wallpaper Engine 的 Steam AppId */
const WALLPAPER_ENGINE_APPID = '431960'

/** Wallpaper Engine 商店页（无 Steam 时回退打开） */
const WALLPAPER_ENGINE_STORE_URL = 'https://store.steampowered.com/app/431960/'

/** 脚本通用返回结构（自定义契约，解析后映射为 shared 类型） */
interface ScriptResult {
  ok: boolean
  data?: unknown
  code?: string
  message?: string
}

/** 应用配置（%AppData%\WinTunerPro\config.json），记录用户选择，跨重启保持 */
interface WtConfig {
  currentWallpaperId?: string | null
}

/** 应用数据根目录：%AppData%\WinTunerPro */
function getWtDir(): string {
  return join(app.getPath('appData'), 'WinTunerPro')
}

/** 写系统前的备份落地目录：%AppData%\WinTunerPro\backups */
function getBackupDir(): string {
  return join(getWtDir(), 'backups')
}

/** 应用配置文件路径 */
function getConfigFile(): string {
  return join(getWtDir(), 'config.json')
}

/** 脚本根目录：开发态用项目根，打包态用 process.resourcesPath（需 electron-builder extraResources 携带 scripts/） */
function getScriptsRoot(): string {
  return app.isPackaged ? join(process.resourcesPath, 'scripts') : join(app.getAppPath(), 'scripts')
}

/** 离线资源根目录：开发态项目根，打包态 process.resourcesPath（需 extraResources 携带 resources/） */
function getResourcesRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
}

/** 允许扫描/应用的静态壁纸目录（随包风格包 + 用户壁纸目录） */
function getWallpaperDirs(): string[] {
  return [join(getResourcesRoot(), 'themes'), join(getWtDir(), 'wallpapers')]
}

/** 读取应用配置，文件不存在或损坏时返回空对象 */
function readConfig(): WtConfig {
  try {
    return JSON.parse(readFileSync(getConfigFile(), 'utf-8')) as WtConfig
  } catch {
    return {}
  }
}

/** 合并写入应用配置 */
function writeConfig(patch: Partial<WtConfig>): void {
  const next = { ...readConfig(), ...patch }
  mkdirSync(dirname(getConfigFile()), { recursive: true })
  writeFileSync(getConfigFile(), JSON.stringify(next, null, 2), 'utf-8')
}

/** 从脚本 stdout 中提取最后一行 JSON 结果 */
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
        // 非完整 JSON，继续向上查找
      }
    }
  }
  throw new Error('无法解析脚本输出（未找到 JSON 结果）')
}

/**
 * 调用 scripts/wallpaper 下的 PowerShell 脚本并返回解析后的 data。
 * 失败/超时/业务错误码统一抛出可读错误，供前端以人话提示 + 重试/跳过。
 */
async function runWallpaperScript<T>(
  scriptName: string,
  args: string[] = [],
  timeoutMs = 60000,
): Promise<T> {
  const scriptPath = join(getScriptsRoot(), 'wallpaper', scriptName)
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
    // 脚本以非零退出码结束时，业务错误 JSON 仍在 stdout 里
    stdout = e.stdout ?? ''
    if (!stdout) throw new Error(`脚本执行失败：${scriptName} - ${e.message ?? '未知错误'}`)
  }

  const parsed = parseScriptResult(stdout)
  if (!parsed.ok) {
    throw new Error(`[${parsed.code ?? 'ERR'}] ${parsed.message ?? '脚本返回失败'}`)
  }
  return parsed.data as T
}

/** Get-WallpaperState.ps1 的 data 结构 */
interface WallpaperStateScriptData {
  currentWallpaperId: string | null
  currentWallpaperPath: string
  items: WallpaperItem[] | WallpaperItem
}

/** Get-WallpaperEngine.ps1 的 data 结构（含主进程内部使用的额外字段） */
interface WallpaperEngineScriptData {
  installed: boolean
  detectedViaSteam: boolean
  steamAppId: string
  steamInstalled: boolean
  steamPath: string
  installDir: string
}

/** 列出可用壁纸与当前壁纸。无资源目录时返回空列表而非报错。 */
export async function listWallpapers(): Promise<WallpaperState> {
  const cfg = readConfig()
  const data = await runWallpaperScript<WallpaperStateScriptData>('Get-WallpaperState.ps1', [
    '-Dirs',
    // 以 | 分隔（| 在 Windows 路径中非法），脚本侧再 split，避免含空格路径的数组绑定歧义
    getWallpaperDirs().join('|'),
    '-CurrentId',
    cfg.currentWallpaperId ?? '',
  ])

  // PowerShell 单元素数组可能被序列化为对象，这里统一归一化为数组
  const rawItems = data.items
  const items: WallpaperItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []

  return {
    currentWallpaperId: cfg.currentWallpaperId ?? data.currentWallpaperId ?? null,
    items,
  }
}

/** 把 id（static:<绝对路径>）解析为受白名单约束的真实文件路径 */
function resolveStaticWallpaperPath(id: string): string {
  if (typeof id !== 'string' || !id.startsWith('static:')) {
    throw new Error('不支持的壁纸标识（仅支持静态壁纸，需 static: 前缀）')
  }
  const target = resolve(id.slice('static:'.length))
  const allowedRoots = getWallpaperDirs().map((d) => resolve(d))
  const allowed = allowedRoots.some((root) =>
    target.toLowerCase().startsWith(root.toLowerCase() + '\\'),
  )
  if (!allowed) {
    throw new Error('壁纸路径不在允许目录内，已拒绝（防注入/越权）')
  }
  if (!existsSync(target)) {
    throw new Error('壁纸文件不存在')
  }
  return target
}

/** 应用静态壁纸为系统桌面壁纸（写操作，脚本内先备份注册表） */
export async function applyStaticWallpaper(id: string): Promise<void> {
  const path = resolveStaticWallpaperPath(id)
  await runWallpaperScript('Set-StaticWallpaper.ps1', [
    '-Path',
    path,
    '-Style',
    'fill',
    '-BackupDir',
    getBackupDir(),
  ])
  writeConfig({ currentWallpaperId: id })
}

/** 检测 Wallpaper Engine 安装状态（只读，仅回传 shared 类型字段） */
export async function detectWallpaperEngine(): Promise<WallpaperEngineStatus> {
  const data = await runWallpaperScript<WallpaperEngineScriptData>(
    'Get-WallpaperEngine.ps1',
    ['-AppId', WALLPAPER_ENGINE_APPID],
    20000,
  )
  return {
    installed: data.installed,
    detectedViaSteam: data.detectedViaSteam,
    steamAppId: data.steamAppId ?? WALLPAPER_ENGINE_APPID,
  }
}

/**
 * 引导安装 Wallpaper Engine。
 * 已装 Steam → 打开 steam://install/431960 拉起 Steam 安装；
 * 未装 Steam → 回退打开商店网页，由用户自行安装 Steam 后再装。
 */
export async function guideInstallWallpaperEngine(): Promise<void> {
  let steamInstalled = false
  try {
    const data = await runWallpaperScript<WallpaperEngineScriptData>(
      'Get-WallpaperEngine.ps1',
      ['-AppId', WALLPAPER_ENGINE_APPID],
      20000,
    )
    steamInstalled = data.steamInstalled
  } catch {
    // 检测失败时按未安装 Steam 处理，回退到网页引导
  }

  if (steamInstalled) {
    await shell.openExternal(`steam://install/${WALLPAPER_ENGINE_APPID}`)
  } else {
    await shell.openExternal(WALLPAPER_ENGINE_STORE_URL)
  }
}
