import { create } from 'zustand'
import type { PowerState } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

/**
 * 电源计划 store：读取电源状态（getPowerState）+ 切换计划（setPowerPlan，写操作）。
 * 切换为写操作，桩阶段会 reject，统一通过 toast 反馈失败并保持当前状态不变。
 */
interface PowerStore {
  data: PowerState | null
  loading: boolean
  error: string | null
  loaded: boolean
  /** 正在切换的计划 GUID（用于按钮 loading 态） */
  applyingGuid: string | null
  load: (force?: boolean) => Promise<void>
  setPlan: (guid: string) => Promise<void>
}

export const usePowerStore = create<PowerStore>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  loaded: false,
  applyingGuid: null,
  load: async (force = false) => {
    const { loading, loaded } = get()
    if (loading) return
    if (loaded && !force) return
    set({ loading: true, error: null })
    try {
      const data = await window.electronAPI.getPowerState()
      set({ data, loading: false, loaded: true })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },
  setPlan: async (guid) => {
    if (get().applyingGuid) return
    set({ applyingGuid: guid })
    try {
      await window.electronAPI.setPowerPlan(guid)
      toast.success('电源计划已切换')
      await get().load(true)
    } catch (err) {
      toast.error('切换电源计划失败', errorMessage(err))
    } finally {
      set({ applyingGuid: null })
    }
  },
}))
