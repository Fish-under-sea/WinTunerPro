import { create } from 'zustand'
import type { SystemInfo, DeviceInfo } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'

/**
 * 硬件信息 store：同时承载系统信息（getSystemInfo）与设备信息（getDeviceInfo）。
 * 两者常一起展示（硬件信息页、仪表盘），合并到一个 store 便于一次加载。
 */
interface HardwareState {
  systemInfo: SystemInfo | null
  deviceInfo: DeviceInfo | null
  loading: boolean
  error: string | null
  loaded: boolean
  load: (force?: boolean) => Promise<void>
}

export const useHardwareStore = create<HardwareState>((set, get) => ({
  systemInfo: null,
  deviceInfo: null,
  loading: false,
  error: null,
  loaded: false,
  load: async (force = false) => {
    const { loading, loaded } = get()
    if (loading) return
    if (loaded && !force) return
    set({ loading: true, error: null })
    try {
      const [systemInfo, deviceInfo] = await Promise.all([
        window.electronAPI.getSystemInfo(),
        window.electronAPI.getDeviceInfo(),
      ])
      set({ systemInfo, deviceInfo, loading: false, loaded: true })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },
}))
