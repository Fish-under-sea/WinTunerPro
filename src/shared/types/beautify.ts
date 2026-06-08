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

/** 美化整体状态（`beautify:get-status` 返回结构） */
export interface BeautifyStatus {
  /** TranslucentTB（任务栏透明工具）状态 */
  translucenttb: ToolInstallStatus
  /** Nexus（Dock 工具）状态 */
  nexus: ToolInstallStatus
  /** 当前已应用的风格包 id，未应用为 null */
  currentThemeId: string | null
}
