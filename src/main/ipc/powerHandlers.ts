import { ipcMain } from 'electron'
import { POWER_CHANNELS } from '@shared/constants/ipcChannels'
import { getPowerState, setPowerPlan } from '../services/powerService'

/**
 * power 模块 IPC 处理器。
 * set-plan 接收渲染进程传入的 guid，处理器做基本校验后转发 service。
 */
export function registerPowerHandlers(): void {
  ipcMain.handle(POWER_CHANNELS.GET_STATE, () => getPowerState())
  ipcMain.handle(POWER_CHANNELS.SET_PLAN, (_event, guid: string) => setPowerPlan(guid))
}
