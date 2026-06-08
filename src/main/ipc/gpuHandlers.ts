import { ipcMain } from 'electron'
import { GPU_CHANNELS } from '@shared/constants/ipcChannels'
import { detectGpu } from '../services/gpuService'

/**
 * gpu 模块 IPC 处理器。
 */
export function registerGpuHandlers(): void {
  ipcMain.handle(GPU_CHANNELS.DETECT, () => detectGpu())
}
