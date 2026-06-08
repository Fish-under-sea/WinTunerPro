import { create } from 'zustand'
import type { GpuDetectResult, GpuTweakApplyResult, GpuTweakOption, GpuTweakOptionId } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

interface GpuStore {
  data: GpuDetectResult | null
  options: GpuTweakOption[]
  loading: boolean
  error: string | null
  loaded: boolean
  applying: boolean
  lastApplyResult: GpuTweakApplyResult | null
  load: (force?: boolean) => Promise<void>
  applyTweaks: (optionIds: GpuTweakOptionId[]) => Promise<void>
}

/** 显卡模块 store：检测 + NVIDIA 预设应用。 */
export const useGpuStore = create<GpuStore>((set, get) => ({
  data: null,
  options: [],
  loading: false,
  error: null,
  loaded: false,
  applying: false,
  lastApplyResult: null,
  load: async (force = false) => {
    const { loading, loaded } = get()
    if (loading) return
    if (loaded && !force) return
    set({ loading: true, error: null })
    try {
      const [data, options] = await Promise.all([
        window.electronAPI.detectGpu(),
        window.electronAPI.listGpuTweakOptions(),
      ])
      set({ data, options, loading: false, loaded: true })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },
  applyTweaks: async (optionIds) => {
    if (get().applying) return
    set({ applying: true })
    try {
      const result = await window.electronAPI.applyGpuTweaks(optionIds)
      set({ lastApplyResult: result })
      if (result.success) {
        toast.success('显卡调节项已执行', result.summary)
      } else {
        toast.warning('显卡调节项执行完成', result.summary)
      }
      if (result.warnings.length > 0) {
        toast.warning('执行告警', result.warnings.join('；'))
      }
      await get().load(true)
    } catch (err) {
      toast.error('应用显卡调节项失败', errorMessage(err))
    } finally {
      set({ applying: false })
    }
  },
}))
