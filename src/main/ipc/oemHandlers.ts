import { ipcMain } from 'electron'
import { OEM_CHANNELS } from '@shared/constants/ipcChannels'
import type { OemPerformanceMode } from '@shared/types/oem'
import { detectOem, applyOemMode } from '../services/oemService'

/**
 * oem 模块 IPC 处理器。
 */
export function registerOemHandlers(): void {
  ipcMain.handle(OEM_CHANNELS.DETECT, () => detectOem())
  ipcMain.handle(OEM_CHANNELS.APPLY_MODE, (_event, mode: OemPerformanceMode) => applyOemMode(mode))
}
