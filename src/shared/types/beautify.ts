/**
 * beautify 模块共享类型——系统美化（TranslucentTB / Nexus）（数据契约）。
 *
 * 对应手段：
 *   - 工具安装状态：检测安装路径 / 注册表卸载项 / 进程是否运行。
 *   - 安装：调用随包离线安装包静默安装（TranslucentTB、Nexus Dock）。
 *   - Nexus UI 预设：以离线 .wbk 备份对齐 Nexus 界面设置（忽略快捷方式）。
 * 安装/应用属写系统操作，由功能代理实现并落备份。
 */

/** 第三方美化工具的安装/运行状态 */
export interface ToolInstallStatus {
  /** 是否已安装 */
  installed: boolean
  /** 已安装版本（installed=true 时可有值） */
  version?: string
  /** 是否正在运行 */
  running?: boolean
}

/**
 * 安装进度事件（main→renderer 单向推送，`beautify:install-progress`）。
 * 由安装脚本以 `WT_PROGRESS:{json}` 行输出，经 service 透传到渲染进程进度条。
 */
export interface InstallProgress {
  /** 进度归属的工具 */
  tool: 'translucenttb' | 'nexus'
  /** 百分比 0–100 */
  percent: number
  /** 当前阶段文案（人话，直接展示） */
  stage: string
  /** 是否已结束（成功或失败的终态） */
  done?: boolean
  /** 失败时的错误信息（done=true 且失败时有值） */
  error?: string
}

/** 美化整体状态（`beautify:get-status` 返回结构） */
export interface BeautifyStatus {
  /** TranslucentTB（任务栏透明工具）状态 */
  translucenttb: ToolInstallStatus
  /** Nexus（Dock 工具）状态 */
  nexus: ToolInstallStatus
}

/** Nexus 安装结果：安装成功后返回配置导入与告警信息，避免“安装成功被误判失败”。 */
export interface NexusInstallResult {
  /** 安装来源（当前固定为离线 exe） */
  installedBy: 'offline-exe'
  /** 是否成功导入了传入的配置 */
  configImported: boolean
  /** 导入前备份路径（键不存在或未导入时为空） */
  backup?: string
  /** 非致命告警（例如安装器非零退出但已验真安装成功） */
  warnings?: string[]
}

/** Nexus 预设配置支持的两种来源格式：.reg（注册表导出，最稳）/ .wbk（Nexus 备份 INI）。 */
export type NexusConfigFormat = 'reg' | 'wbk'

/**
 * `.wbk` 段名 → 注册表子键（HKCU\Software\WinSTEP2000\<子键>）的映射「数据契约」。
 *
 * 这是主进程 ↔ PowerShell 之间关于 .wbk 解析落点的唯一约定来源，
 * `scripts/beautify/_BeautifyCommon.ps1` 的 `$NexusSectionToSubKey` 必须与此保持一致。
 *
 * 验证状态：
 *   - WORKSHELF ↔ NeXuS、SHARED ↔ Shared：已上机比对验证（键名/键值与 .wbk 完全一致）。
 *   - DOCKS ↔ NeXuS：⚠ 尚未上机验证（调研机无自定义 Dock 项，无法 diff），
 *     故 .wbk 导入路径默认 DryRun（仅预演不写入），需在装 Nexus 的机器上 GUI 恢复后 diff 确认。
 */
export const NEXUS_WBK_SECTION_TO_SUBKEY: Readonly<Record<string, string>> = {
  WORKSHELF: 'NeXuS',
  SHARED: 'Shared',
  DOCKS: 'NeXuS',
}

/**
 * 判定一个 `.wbk` 键名是否为「快捷方式 / Dock 图标条目项」（应跳过，不写入注册表）。
 *
 * 这是「快捷方式项 vs UI 设置」判定的「唯一真相源」，PowerShell 侧
 * （`_BeautifyCommon.ps1` 的 `Test-NexusShortcutKey`）必须与此保持一致的规则。
 *
 * 判定依据（基于对真实 `resources/themes/nexus/wsbackup.wbk` 的观察，非凭空假设）：
 *   - `[DOCKS]` 段里每个 Dock 图标条目以 `<dock序号><字段名><条目序号>` 命名，例如：
 *       `1Label0=此电脑`、`1Path0=C:\桌面快捷方式\此电脑.lnk`、`1StartPath0=...`、
 *       `1Type0=1`、`1Hotkey2=65`（字段含 标签 / .lnk 路径 / 启动目录 / 类型 / 热键）。
 *     这些键的共同特征是「以数字开头」（dock 序号前缀）。
 *   - 而所有 UI / 外观 / 行为键一律「以字母开头」：`DockIconSize1`、`DockFxEffect1`、
 *     `DockPosX1`、`NeXuSThemeName`、`GenThemeName`、`Win7TaskbarMode` 等。
 *
 * 规则：
 *   1. 键名以数字开头 → 快捷方式条目项（跳过）。
 *   2. `DockNoItems<n>`（Dock 条目计数）→ 也跳过：用户要求不动本机快捷方式，
 *      若只写计数却不写条目，会与本机实际 Dock 内容不一致，故一并保守跳过。
 *
 * 保守原则（见任务约束）：宁可多跳过疑似快捷方式项，也不要误写覆盖用户本机快捷方式。
 * 其余键（Dock 外观/尺寸/动效/位置、主题、`[WORKSHELF]`、`[SHARED]`）均视为 UI 设置，写入对齐。
 */
export function isNexusShortcutKey(key: string): boolean {
  if (/^\d/.test(key)) return true
  if (/^DockNoItems\d+$/i.test(key)) return true
  return false
}

/**
 * 把一组 `.wbk` 键名按「UI 设置 / 快捷方式项」二分（纯逻辑，便于单测与统计核对）。
 * 写入计划只取 uiKeys；shortcutKeys 用于「跳过 M 项」统计。
 */
export function partitionNexusBackupKeys(keys: string[]): {
  uiKeys: string[]
  shortcutKeys: string[]
} {
  const uiKeys: string[] = []
  const shortcutKeys: string[] = []
  for (const k of keys) {
    if (isNexusShortcutKey(k)) shortcutKeys.push(k)
    else uiKeys.push(k)
  }
  return { uiKeys, shortcutKeys }
}

/** 从文件名解析 Nexus 配置格式；非 .reg/.wbk 返回 null。 */
export function resolveNexusConfigFormat(fileName: string): NexusConfigFormat | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.reg')) return 'reg'
  if (lower.endsWith('.wbk')) return 'wbk'
  return null
}

/**
 * 在候选文件名中选出 Nexus 预设来源（扩展名分流判断，纯逻辑便于单测）。
 *   - 优先 `.reg`：注册表导出，落点已验证、导入最稳；
 *   - 退而求其次 `.wbk`：运营更友好，但 [DOCKS] 落点未上机验证（调用方应默认 DryRun）；
 *   - 均无 → null（调用方按「跳过」处理）。
 */
export function pickNexusConfigSource(
  fileNames: string[],
): { fileName: string; format: NexusConfigFormat } | null {
  const reg = fileNames.find((f) => resolveNexusConfigFormat(f) === 'reg')
  if (reg) return { fileName: reg, format: 'reg' }
  const wbk = fileNames.find((f) => resolveNexusConfigFormat(f) === 'wbk')
  if (wbk) return { fileName: wbk, format: 'wbk' }
  return null
}

/**
 * Nexus 资源铺设的目标落点 token（绝对路径由主进程按本机环境解析，渲染进程不参与）。
 *   - PUBLIC_WINSTEP_THEMES：%PUBLIC%\Documents\WinStep\Themes（Nexus 主题位图固定位置）
 *   - PUBLIC_WINSTEP_ICONS ：%PUBLIC%\Documents\WinStep\Icons （图标资源）
 *
 * 注：快捷方式（.lnk → %PUBLIC%\Desktop）已从约定中移除——按需求「不动本机快捷方式、
 * 不下发任何快捷方式相关内容」，故不再保留快捷方式落点 token。
 */
export type NexusDeployTargetToken = 'PUBLIC_WINSTEP_THEMES' | 'PUBLIC_WINSTEP_ICONS'

/** 单条资源铺设映射：预设包内子目录 → 目标落点 token。 */
export interface NexusDeployEntry {
  /** 预设包内子目录名（resources/themes/<id>/nexus/<source>/） */
  source: string
  /** 目标落点 token */
  target: NexusDeployTargetToken
}

/**
 * 预设包内子目录 → 目标落点 的约定表（资源铺设的唯一约定来源）。
 *
 * 仅含「UI 外观必需」资源：
 *   - theme：主题位图（如 Windows10Nx），wbk 以绝对路径引用，缺失会导致外观对不齐 → 需随包铺设。
 *   - icons：模块/图标资源（同为外观依赖）。
 * 刻意不含 shortcuts：用户要求不动本机快捷方式，也不下发任何 .lnk，故快捷方式资源一律不铺。
 */
export const NEXUS_DEPLOY_CONVENTION: readonly NexusDeployEntry[] = [
  { source: 'theme', target: 'PUBLIC_WINSTEP_THEMES' },
  { source: 'icons', target: 'PUBLIC_WINSTEP_ICONS' },
]

/**
 * 依据「预设包内实际存在的子目录」组装资源铺设清单（纯逻辑便于单测）。
 * 仅纳入约定表中且实际存在的子目录，避免对不存在的资源发起铺设。
 */
export function buildNexusDeployManifest(presentSubdirs: string[]): NexusDeployEntry[] {
  const present = new Set(presentSubdirs.map((s) => s.toLowerCase()))
  return NEXUS_DEPLOY_CONVENTION.filter((e) => present.has(e.source.toLowerCase()))
}

/**
 * Nexus 预置配置导入结果（`Import-NexusConfig.ps1` 的 data，与安装解耦）。
 * 形态对齐 NexusInstallResult（去掉 installedBy），便于上层统一处理。
 * 同时兼容 .reg（reg import）与 .wbk（INI 段→注册表）两条同源底层路径。
 */
export interface NexusConfigImportResult {
  /** 是否成功导入了预置配置（DryRun 预演时为 false） */
  configImported: boolean
  /** 实际使用的来源格式（reg / wbk） */
  format?: NexusConfigFormat
  /** 是否为预演（仅 .wbk 默认 true：[DOCKS] 落点未上机验证，仅输出将写入项不落盘） */
  dryRun?: boolean
  /** 导入前备份路径（键不存在或 DryRun 时为空） */
  backup?: string
  /** .wbk 真实写入的注册表项数（已过滤掉快捷方式项） */
  writtenCount?: number
  /** .wbk 预演/写入计划的注册表项数（已过滤掉快捷方式项） */
  plannedCount?: number
  /** .wbk 中被识别为「快捷方式 / Dock 图标条目」而跳过、未写入的项数 */
  skippedShortcutCount?: number
  /** .wbk 命中的段名（WORKSHELF / SHARED / DOCKS 等） */
  sections?: string[]
  /** 非致命告警（例如自动重启 Nexus 失败、编码兼容回退） */
  warnings?: string[]
}

/** Nexus 资源铺设结果（`Deploy-NexusResources.ps1` 的 data）。 */
export interface NexusDeployResult {
  /** 实际铺设（复制）到目标位置的文件数 */
  deployedCount: number
  /** 已铺设文件样例（截断展示，避免数据过大） */
  deployed?: string[]
  /** 覆盖前备份落点目录 */
  backupDir?: string
  /** 非致命告警（例如某子目录在预设包内缺失） */
  warnings?: string[]
}
