import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { BEAUTIFY_CHANNELS } from '@shared/constants/ipcChannels'
import type { InstallProgress } from '@shared/types/beautify'
import {
  getBeautifyStatus,
  installTranslucentTB,
  installNexus,
  applyTheme,
} from '../services/beautifyService'
import type { InstallProgressUpdate } from '../services/beautifyService'

/**
 * 把 service 的进度回调转成「发回调用方渲染进程」的推送。
 * sender 可能在安装途中被销毁（窗口关闭/刷新），发送前做存活判断避免抛错。
 */
function forwardInstallProgress(
  event: IpcMainInvokeEvent,
  tool: InstallProgress['tool'],
): (p: InstallProgressUpdate) => void {
  return (p) => {
    if (event.sender.isDestroyed()) return
    event.sender.send(BEAUTIFY_CHANNELS.INSTALL_PROGRESS, { tool, ...p } satisfies InstallProgress)
  }
}

/**
 * beautify 模块 IPC 处理器。
 * apply-theme 接收渲染进程传入的风格包 id，处理器做基本校验后转发 service。
 * 安装类把脚本流式进度回传调用方渲染进程（beautify:install-progress）。
 */
export function registerBeautifyHandlers(): void {
  ipcMain.handle(BEAUTIFY_CHANNELS.GET_STATUS, () => getBeautifyStatus())
  ipcMain.handle(BEAUTIFY_CHANNELS.INSTALL_TRANSLUCENTTB, (event) =>
    installTranslucentTB(forwardInstallProgress(event, 'translucenttb')),
  )
  ipcMain.handle(BEAUTIFY_CHANNELS.INSTALL_NEXUS, (event) =>
    installNexus(forwardInstallProgress(event, 'nexus')),
  )
  ipcMain.handle(BEAUTIFY_CHANNELS.APPLY_THEME, (_event, themeId: string) => applyTheme(themeId))
}
