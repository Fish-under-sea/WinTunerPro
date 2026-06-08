import { ipcMain } from 'electron'
import { HARDWARE_CHANNELS } from '@shared/constants/ipcChannels'
import { getSystemInfo, getDeviceInfo } from '../services/hardwareService'

/**
 * hardware 模块 IPC 处理器。
 * 处理器保持轻薄：仅做转发，业务逻辑在 hardwareService。
 */
export function registerHardwareHandlers(): void {
  ipcMain.handle(HARDWARE_CHANNELS.GET_SYSTEM_INFO, () => getSystemInfo())
  ipcMain.handle(HARDWARE_CHANNELS.GET_DEVICE_INFO, () => getDeviceInfo())
}
