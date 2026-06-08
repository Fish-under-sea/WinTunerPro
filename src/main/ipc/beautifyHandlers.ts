import { ipcMain } from 'electron'
import { BEAUTIFY_CHANNELS } from '@shared/constants/ipcChannels'
import {
  getBeautifyStatus,
  installTranslucentTB,
  installNexus,
  applyTheme,
} from '../services/beautifyService'

/**
 * beautify 模块 IPC 处理器。
 * apply-theme 接收渲染进程传入的风格包 id，处理器做基本校验后转发 service。
 */
export function registerBeautifyHandlers(): void {
  ipcMain.handle(BEAUTIFY_CHANNELS.GET_STATUS, () => getBeautifyStatus())
  ipcMain.handle(BEAUTIFY_CHANNELS.INSTALL_TRANSLUCENTTB, () => installTranslucentTB())
  ipcMain.handle(BEAUTIFY_CHANNELS.INSTALL_NEXUS, () => installNexus())
  ipcMain.handle(BEAUTIFY_CHANNELS.APPLY_THEME, (_event, themeId: string) => applyTheme(themeId))
}
