import { ipcMain } from 'electron'
import { BACKUP_CHANNELS } from '@shared/constants/ipcChannels'
import {
  createSnapshot,
  deleteBackup,
  exportWtp,
  importWtp,
  listBackups,
  restoreBackup,
} from '../services/backupService'

/**
 * backup 模块 IPC 处理器。
 * 处理器只做参数透传/基本校验，业务逻辑（含路径白名单、加解密、脚本调度）在 service 内。
 */
export function registerBackupHandlers(): void {
  ipcMain.handle(BACKUP_CHANNELS.LIST, () => listBackups())
  ipcMain.handle(BACKUP_CHANNELS.CREATE_SNAPSHOT, (_event, name?: string) => createSnapshot(name))
  ipcMain.handle(BACKUP_CHANNELS.RESTORE, (_event, id: string) => restoreBackup(id))
  ipcMain.handle(BACKUP_CHANNELS.DELETE, (_event, id: string) => deleteBackup(id))
  ipcMain.handle(BACKUP_CHANNELS.EXPORT_WTP, () => exportWtp())
  ipcMain.handle(BACKUP_CHANNELS.IMPORT_WTP, () => importWtp())
}
