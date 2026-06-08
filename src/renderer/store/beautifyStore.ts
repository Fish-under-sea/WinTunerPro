import { create } from 'zustand'
import type { BeautifyStatus } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

/**
 * 系统美化 store：读取工具与风格包状态（getBeautifyStatus），
 * 安装 TranslucentTB / Nexus、应用风格包（写操作）。
 */
type BusyKey = 'translucenttb' | 'nexus' | string

interface BeautifyStore {
  data: BeautifyStatus | null
  loading: boolean
  error: string | null
  loaded: boolean
  /** 正在进行的写操作标识（工具名或 themeId），用于按钮 loading */
  busy: BusyKey | null
  load: (force?: boolean) => Promise<void>
  installTranslucentTB: () => Promise<void>
  installNexus: () => Promise<void>
  applyTheme: (themeId: string) => Promise<void>
}

export const useBeautifyStore = create<BeautifyStore>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  loaded: false,
  busy: null,
  load: async (force = false) => {
    const { loading, loaded } = get()
    if (loading) return
    if (loaded && !force) return
    set({ loading: true, error: null })
    try {
      const data = await window.electronAPI.getBeautifyStatus()
      set({ data, loading: false, loaded: true })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },
  installTranslucentTB: async () => {
    if (get().busy) return
    set({ busy: 'translucenttb' })
    try {
      await window.electronAPI.installTranslucentTB()
      toast.success('TranslucentTB 安装完成')
      await get().load(true)
    } catch (err) {
      toast.error('安装 TranslucentTB 失败', errorMessage(err))
    } finally {
      set({ busy: null })
    }
  },
  installNexus: async () => {
    if (get().busy) return
    set({ busy: 'nexus' })
    try {
      await window.electronAPI.installNexus()
      toast.success('Nexus 安装完成')
      await get().load(true)
    } catch (err) {
      toast.error('安装 Nexus 失败', errorMessage(err))
    } finally {
      set({ busy: null })
    }
  },
  applyTheme: async (themeId) => {
    if (get().busy) return
    set({ busy: themeId })
    try {
      await window.electronAPI.applyTheme(themeId)
      toast.success('风格包已应用')
      await get().load(true)
    } catch (err) {
      toast.error('应用风格包失败', errorMessage(err))
    } finally {
      set({ busy: null })
    }
  },
}))
