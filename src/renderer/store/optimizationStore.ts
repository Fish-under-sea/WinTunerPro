import { create } from 'zustand'
import type { OptimizationApplyResult, OptimizationItemId, OptimizationScanResult } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

interface OptimizationStore {
  scanning: boolean
  applying: boolean
  scanResults: OptimizationScanResult | null
  applyResults: OptimizationApplyResult | null
  scan: (itemIds: OptimizationItemId[]) => Promise<void>
  apply: (itemIds: OptimizationItemId[]) => Promise<void>
}

export function summarizeOptimizationResult(result: OptimizationApplyResult): string {
  const successCount = result.results.filter((r) => r.status === 'success').length
  const failedCount = result.results.filter((r) => r.status === 'failed').length
  return `成功 ${successCount} 项，失败 ${failedCount} 项`
}

export function getRecommendedOptimizationItems(result: OptimizationScanResult): OptimizationItemId[] {
  return result.results.filter((item) => item.status === 'recommended').map((item) => item.itemId)
}

/** 系统优化 store：按白名单 itemId 下发真实优化脚本。 */
export const useOptimizationStore = create<OptimizationStore>((set) => ({
  scanning: false,
  applying: false,
  scanResults: null,
  applyResults: null,
  scan: async (itemIds) => {
    if (itemIds.length === 0) {
      toast.warning('请先选择至少一项用于体检')
      return
    }
    set({ scanning: true })
    try {
      const result = await window.electronAPI.scanOptimizations(itemIds)
      set({ scanResults: result })
      toast.success('系统体检完成', result.summary)
      if (result.warnings.length > 0) {
        toast.warning('体检告警', result.warnings.join('；'))
      }
    } catch (err) {
      toast.error('系统体检失败', errorMessage(err))
    } finally {
      set({ scanning: false })
    }
  },
  apply: async (itemIds) => {
    if (itemIds.length === 0) {
      toast.warning('请先选择至少一项优化')
      return
    }
    set({ applying: true })
    try {
      const result = await window.electronAPI.applyOptimizations(itemIds)
      set({ applyResults: result })
      if (result.success) {
        toast.success('系统优化执行完成', summarizeOptimizationResult(result))
      } else {
        toast.warning('系统优化部分失败', summarizeOptimizationResult(result))
      }
      if (result.warnings.length > 0) {
        toast.warning('优化执行告警', result.warnings.join('；'))
      }
    } catch (err) {
      toast.error('系统优化执行失败', errorMessage(err))
    } finally {
      set({ applying: false })
    }
  },
}))
