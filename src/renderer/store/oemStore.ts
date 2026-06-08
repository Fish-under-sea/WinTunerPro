import { create } from 'zustand'
import type { OemApplyResult, OemDetectResult, OemPerformanceMode } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

interface OemStore {
  data: OemDetectResult | null
  loading: boolean
  error: string | null
  loaded: boolean
  applying: boolean
  lastApplyResult: OemApplyResult | null
  load: (force?: boolean) => Promise<void>
  applyMode: (mode: OemPerformanceMode) => Promise<void>
}

function dedupeWarnings(items: string[]): string[] {
  return Array.from(new Set(items.map((x) => x.trim()).filter(Boolean))).slice(0, 2)
}

/** OEM store：检测品牌 + 应用性能模式。 */
export const useOemStore = create<OemStore>((set, get) => ({
  data: null,
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
      const data = await window.electronAPI.detectOem()
      set({ data, loading: false, loaded: true })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },
  applyMode: async (mode) => {
    if (get().applying) return
    set({ applying: true })
    try {
      const rawResult = await window.electronAPI.applyOemMode(mode)
      const warnings = dedupeWarnings(rawResult.warnings ?? [])
      const result: OemApplyResult = { ...rawResult, warnings }
      set({ lastApplyResult: result })
      if (result.usedBrandMode) {
        toast.success('品牌性能模式已应用', result.message)
      } else if (result.usedPowerFallback) {
        const reason = warnings[0] ? `；原因：${warnings[0]}` : ''
        toast.warning('已走电源计划兜底', `${result.message}${reason}`)
      } else {
        toast.warning('性能模式未生效', result.message)
      }
      if (warnings.length > 0 && !result.usedPowerFallback) {
        toast.warning('OEM 调度告警', warnings.join('；'))
      }
      await get().load(true)
    } catch (err) {
      toast.error('应用 OEM 模式失败', errorMessage(err))
    } finally {
      set({ applying: false })
    }
  },
}))
