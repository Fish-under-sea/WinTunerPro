import { app } from 'electron'
import type { AppInfo } from '@shared/types/app'

/**
 * 应用级业务服务（占位示例）。
 *
 * services 层承载真正的业务逻辑（脚本调度、备份、硬件检测等），
 * 供 IPC 处理器调用。后续如 gpuService.ts、oemService.ts、powershellService.ts 等。
 */
export function getAppInfo(): AppInfo {
  return {
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
  }
}
