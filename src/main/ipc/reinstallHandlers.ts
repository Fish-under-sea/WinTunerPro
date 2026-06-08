import { ipcMain } from 'electron'
import { REINSTALL_CHANNELS } from '@shared/constants/ipcChannels'
import { listSystemImageSources, importIso, getMachineId } from '../services/reinstallService'

/**
 * reinstall 模块 IPC 处理器。
 * import-iso 接收渲染进程传入的 ISO 路径，处理器做基本校验后转发 service。
 */
export function registerReinstallHandlers(): void {
  ipcMain.handle(REINSTALL_CHANNELS.LIST_SOURCES, () => listSystemImageSources())
  ipcMain.handle(REINSTALL_CHANNELS.IMPORT_ISO, (_event, path: string) => importIso(path))
  ipcMain.handle(REINSTALL_CHANNELS.GET_MACHINE_ID, () => getMachineId())
}
