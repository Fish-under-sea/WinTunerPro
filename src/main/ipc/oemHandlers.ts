import { ipcMain } from 'electron'
import { OEM_CHANNELS } from '@shared/constants/ipcChannels'
import { detectOem } from '../services/oemService'

/**
 * oem 模块 IPC 处理器。
 */
export function registerOemHandlers(): void {
  ipcMain.handle(OEM_CHANNELS.DETECT, () => detectOem())
}
