import { create } from 'zustand'
import type { SystemImageSource, MachineIdInfo, IsoValidationResult } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

/**
 * 系统重装 store：镜像来源列表（listSystemImageSources）+ 机器码（getMachineId）只读，
 * 自定义 ISO 导入校验（importIso，写操作）。
 */
interface ReinstallStore {
  sources: SystemImageSource[] | null
  machineId: MachineIdInfo | null
  loading: boolean
  error: string | null
  loaded: boolean
  /** 正在导入校验 ISO */
  importing: boolean
  /** 最近一次 ISO 校验结果 */
  lastImport: IsoValidationResult | null
  load: (force?: boolean) => Promise<void>
  importIso: (path: string) => Promise<void>
}

export const useReinstallStore = create<ReinstallStore>((set, get) => ({
  sources: null,
  machineId: null,
  loading: false,
  error: null,
  loaded: false,
  importing: false,
  lastImport: null,
  load: async (force = false) => {
    const { loading, loaded } = get()
    if (loading) return
    if (loaded && !force) return
    set({ loading: true, error: null })
    try {
      const [sources, machineId] = await Promise.all([
        window.electronAPI.listSystemImageSources(),
        window.electronAPI.getMachineId(),
      ])
      set({ sources, machineId, loading: false, loaded: true })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },
  importIso: async (path) => {
    if (get().importing) return
    set({ importing: true, lastImport: null })
    try {
      const result = await window.electronAPI.importIso(path)
      set({ lastImport: result })
      if (result.valid) {
        toast.success('ISO 校验通过', result.bootableVersion)
      } else {
        toast.error('ISO 校验未通过', result.errorMessage)
      }
    } catch (err) {
      toast.error('导入 ISO 失败', errorMessage(err))
    } finally {
      set({ importing: false })
    }
  },
}))
