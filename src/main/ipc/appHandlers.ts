import { ipcMain } from 'electron'
import { APP_CHANNELS } from '@shared/constants/ipcChannels'
import { getAppInfo } from '../services/appService'

/**
 * 应用级 IPC 处理器（示例）。
 * 处理器本身保持轻薄：仅做参数校验与转发，具体逻辑交由 services。
 */
export function registerAppHandlers(): void {
  // 渲染进程通过 window.electronAPI.getAppVersion() 调用
  ipcMain.handle(APP_CHANNELS.GET_VERSION, () => getAppInfo())
}
