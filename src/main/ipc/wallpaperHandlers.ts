import { ipcMain } from 'electron'
import { WALLPAPER_CHANNELS } from '@shared/constants/ipcChannels'
import {
  listWallpapers,
  applyStaticWallpaper,
  detectWallpaperEngine,
  guideInstallWallpaperEngine,
} from '../services/wallpaperService'

/**
 * wallpaper 模块 IPC 处理器。
 * apply-static 接收渲染进程传入的壁纸 id，处理器做基本校验后转发 service。
 */
export function registerWallpaperHandlers(): void {
  ipcMain.handle(WALLPAPER_CHANNELS.LIST, () => listWallpapers())
  ipcMain.handle(WALLPAPER_CHANNELS.APPLY_STATIC, (_event, id: string) => applyStaticWallpaper(id))
  ipcMain.handle(WALLPAPER_CHANNELS.DETECT_ENGINE, () => detectWallpaperEngine())
  ipcMain.handle(WALLPAPER_CHANNELS.GUIDE_INSTALL_ENGINE, () => guideInstallWallpaperEngine())
}
