/**
 * beautify 模块共享类型——系统美化（TranslucentTB / Nexus / 风格包）（数据契约）。
 *
 * 对应手段：
 *   - 工具安装状态：检测安装路径 / 注册表卸载项 / 进程是否运行。
 *   - 安装：调用随包离线安装包静默安装（TranslucentTB、Nexus Dock）。
 *   - 风格包：应用预置主题资源（壁纸/图标/任务栏样式等组合）。
 * 安装/应用属写系统操作，桩阶段抛“未实现”，由功能代理实现并落备份。
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

/** 风格包（预置主题，供前端展示与选择） */
export interface ThemePack {
  /** 风格包唯一 id */
  id: string
  /** 风格包名称，如 “赛博朋克” / “极简白” / “电竞红” */
  name: string
  /** 预览图（资源路径或 data URI） */
  preview: string
  /** 风格包说明 */
  description: string
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
  /** 当前已应用的风格包 id，未应用为 null */
  currentThemeId: string | null
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
