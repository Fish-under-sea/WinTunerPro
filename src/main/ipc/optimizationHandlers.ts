import { ipcMain } from 'electron'
import { OPTIMIZATION_CHANNELS } from '@shared/constants/ipcChannels'
import type { OptimizationItemId } from '@shared/types/optimization'
import { applyOptimizations, scanOptimizations } from '../services/optimizationService'

/**
 * optimization 模块 IPC 处理器。
 */
export function registerOptimizationHandlers(): void {
  ipcMain.handle(OPTIMIZATION_CHANNELS.SCAN, (_event, itemIds: OptimizationItemId[]) =>
    scanOptimizations(itemIds),
  )
  ipcMain.handle(OPTIMIZATION_CHANNELS.APPLY, (_event, itemIds: OptimizationItemId[]) =>
    applyOptimizations(itemIds),
  )
}
