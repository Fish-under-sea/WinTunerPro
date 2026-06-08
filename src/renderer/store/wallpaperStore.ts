import { create } from 'zustand'
import type { WallpaperState, WallpaperEngineStatus } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

/**
 * 壁纸 store：静态壁纸列表（listWallpapers）+ Wallpaper Engine 检测（detectWallpaperEngine），
 * 应用静态壁纸、引导安装 Wallpaper Engine（写操作）。
 */
interface WallpaperStore {
  data: WallpaperState | null
  engine: WallpaperEngineStatus | null
  loading: boolean
  error: string | null
  loaded: boolean
  /** 正在应用的壁纸 id */
  applyingId: string | null
  /** 正在引导安装 Wallpaper Engine */
  guiding: boolean
  load: (force?: boolean) => Promise<void>
  applyStatic: (id: string) => Promise<void>
  guideInstallEngine: () => Promise<void>
}

export const useWallpaperStore = create<WallpaperStore>((set, get) => ({
  data: null,
  engine: null,
  loading: false,
  error: null,
  loaded: false,
  applyingId: null,
  guiding: false,
  load: async (force = false) => {
    const { loading, loaded } = get()
    if (loading) return
    if (loaded && !force) return
    set({ loading: true, error: null })
    try {
      const [data, engine] = await Promise.all([
        window.electronAPI.listWallpapers(),
        window.electronAPI.detectWallpaperEngine(),
      ])
      set({ data, engine, loading: false, loaded: true })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },
  applyStatic: async (id) => {
    if (get().applyingId) return
    set({ applyingId: id })
    try {
      await window.electronAPI.applyStaticWallpaper(id)
      toast.success('壁纸已设为桌面背景')
      await get().load(true)
    } catch (err) {
      toast.error('应用壁纸失败', errorMessage(err))
    } finally {
      set({ applyingId: null })
    }
  },
  guideInstallEngine: async () => {
    if (get().guiding) return
    set({ guiding: true })
    try {
      await window.electronAPI.guideInstallWallpaperEngine()
      toast.success('已打开 Wallpaper Engine 安装引导')
    } catch (err) {
      toast.error('打开安装引导失败', errorMessage(err))
    } finally {
      set({ guiding: false })
    }
  },
}))
