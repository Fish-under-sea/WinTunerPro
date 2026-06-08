import { ipcMain } from 'electron'
import { REINSTALL_CHANNELS } from '@shared/constants/ipcChannels'
import {
  listSystemImageSources,
  importIso,
  getMachineId,
  startDeploy,
} from '../services/reinstallService'

/**
 * reinstall 模块 IPC 处理器。
 * import-iso 接收渲染进程传入的 ISO 路径，处理器做基本校验后转发 service。
 * deploy 触发部署（本期为演示流水线），把进度回传调用方渲染进程（reinstall:deploy-progress）。
 */
export function registerReinstallHandlers(): void {
  ipcMain.handle(REINSTALL_CHANNELS.LIST_SOURCES, () => listSystemImageSources())
  ipcMain.handle(REINSTALL_CHANNELS.IMPORT_ISO, (_event, path: string) => importIso(path))
  ipcMain.handle(REINSTALL_CHANNELS.GET_MACHINE_ID, () => getMachineId())
  ipcMain.handle(REINSTALL_CHANNELS.DEPLOY, (event, sourceId: string) =>
    startDeploy(sourceId, (p) => {
      if (event.sender.isDestroyed()) return
      event.sender.send(REINSTALL_CHANNELS.DEPLOY_PROGRESS, p)
    }),
  )
}
