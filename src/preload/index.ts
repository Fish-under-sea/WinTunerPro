import { contextBridge, ipcRenderer } from 'electron'
import {
  APP_CHANNELS,
  HARDWARE_CHANNELS,
  GPU_CHANNELS,
  OEM_CHANNELS,
  POWER_CHANNELS,
  REINSTALL_CHANNELS,
  BEAUTIFY_CHANNELS,
  WALLPAPER_CHANNELS,
} from '@shared/constants/ipcChannels'
import type { ElectronAPI } from '@shared/types/api'
import type { InstallProgress } from '@shared/types/beautify'
import type { ReinstallProgress } from '@shared/types/reinstall'

/**
 * 预加载脚本——主进程与渲染进程之间的唯一桥梁。
 *
 * 安全约束（见 code-organization.mdc）：
 *   - 只暴露白名单方法，绝不把 ipcRenderer 整体透传给渲染进程
 *   - 暴露的 API 形状与 src/shared/types/api.ts 的 ElectronAPI 契约一致
 */
const api: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke(APP_CHANNELS.GET_VERSION),

  // hardware
  getSystemInfo: () => ipcRenderer.invoke(HARDWARE_CHANNELS.GET_SYSTEM_INFO),
  getDeviceInfo: () => ipcRenderer.invoke(HARDWARE_CHANNELS.GET_DEVICE_INFO),

  // gpu
  detectGpu: () => ipcRenderer.invoke(GPU_CHANNELS.DETECT),

  // oem
  detectOem: () => ipcRenderer.invoke(OEM_CHANNELS.DETECT),

  // power
  getPowerState: () => ipcRenderer.invoke(POWER_CHANNELS.GET_STATE),
  setPowerPlan: (guid) => ipcRenderer.invoke(POWER_CHANNELS.SET_PLAN, guid),

  // reinstall
  listSystemImageSources: () => ipcRenderer.invoke(REINSTALL_CHANNELS.LIST_SOURCES),
  importIso: (path) => ipcRenderer.invoke(REINSTALL_CHANNELS.IMPORT_ISO, path),
  getMachineId: () => ipcRenderer.invoke(REINSTALL_CHANNELS.GET_MACHINE_ID),
  startReinstallDeploy: (sourceId) => ipcRenderer.invoke(REINSTALL_CHANNELS.DEPLOY, sourceId),
  onReinstallProgress: (cb) => {
    const fn = (_e: unknown, p: ReinstallProgress): void => cb(p)
    ipcRenderer.on(REINSTALL_CHANNELS.DEPLOY_PROGRESS, fn)
    return () => ipcRenderer.removeListener(REINSTALL_CHANNELS.DEPLOY_PROGRESS, fn)
  },

  // beautify
  getBeautifyStatus: () => ipcRenderer.invoke(BEAUTIFY_CHANNELS.GET_STATUS),
  installTranslucentTB: () => ipcRenderer.invoke(BEAUTIFY_CHANNELS.INSTALL_TRANSLUCENTTB),
  installNexus: () => ipcRenderer.invoke(BEAUTIFY_CHANNELS.INSTALL_NEXUS),
  applyTheme: (themeId) => ipcRenderer.invoke(BEAUTIFY_CHANNELS.APPLY_THEME, themeId),
  onInstallProgress: (cb) => {
    const fn = (_e: unknown, p: InstallProgress): void => cb(p)
    ipcRenderer.on(BEAUTIFY_CHANNELS.INSTALL_PROGRESS, fn)
    return () => ipcRenderer.removeListener(BEAUTIFY_CHANNELS.INSTALL_PROGRESS, fn)
  },

  // wallpaper
  listWallpapers: () => ipcRenderer.invoke(WALLPAPER_CHANNELS.LIST),
  applyStaticWallpaper: (id) => ipcRenderer.invoke(WALLPAPER_CHANNELS.APPLY_STATIC, id),
  detectWallpaperEngine: () => ipcRenderer.invoke(WALLPAPER_CHANNELS.DETECT_ENGINE),
  guideInstallWallpaperEngine: () => ipcRenderer.invoke(WALLPAPER_CHANNELS.GUIDE_INSTALL_ENGINE),
}

// contextIsolation 开启时通过 contextBridge 注入；否则兜底挂到 window（仅防御性处理）
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error('[preload] 暴露 electronAPI 失败：', error)
  }
} else {
  // @ts-expect-error 非隔离环境的兜底（正常情况下 contextIsolation 恒为 true）
  window.electronAPI = api
}
