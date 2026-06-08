/**
 * 应用级共享类型（数据契约示例）。
 *
 * 主进程 ↔ 渲染进程之间传递的数据结构必须在此（src/shared/types）定义并双方复用，
 * 禁止两端各写一份。PowerShell 返回给主进程的结构也应在此有对应 TS 类型。
 *
 * 扩展方式：按模块拆文件（如 gpu.ts、oem.ts、backup.ts），
 * 在 src/shared/types/index.ts 统一 re-export。
 */

/** 应用基础信息（`app:get-version` 返回结构示例） */
export interface AppInfo {
  /** 应用版本号（取自 package.json） */
  version: string
  /** Electron 运行时版本 */
  electronVersion: string
  /** 运行平台，本项目仅 win32 */
  platform: NodeJS.Platform
}
