import type { ElectronAPI } from '@shared/types/api'

/**
 * 全局类型声明：让渲染进程通过 `window.electronAPI` 获得完整类型提示。
 * 实际实现见 src/preload/index.ts，契约见 src/shared/types/api.ts。
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
