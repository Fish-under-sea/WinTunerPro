import { create } from 'zustand'
import type {
  SystemImageSource,
  MachineIdInfo,
  IsoValidationResult,
  ReinstallProgress,
  ChangeMachineIdOptions,
  ChangeMachineIdResult,
} from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

/**
 * 系统重装 store：镜像来源列表（listSystemImageSources）+ 机器码（getMachineId）只读，
 * 自定义 ISO 导入校验（importIso，写操作），以及部署进度（startDeploy，本期为演示流水线）。
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
  /** 是否正在部署（演示流水线进行中） */
  deploying: boolean
  /** 部署进度（null 表示尚未开始/已重置） */
  deployProgress: ReinstallProgress | null
  /** 是否正在更改机器码（写操作进行中） */
  changingMachineId: boolean
  /** 最近一次「更改机器码」结果（null 表示尚未执行/已清空） */
  lastMachineIdChange: ChangeMachineIdResult | null
  load: (force?: boolean) => Promise<void>
  importIso: (path: string) => Promise<void>
  startDeploy: (sourceId: string) => Promise<void>
  resetDeploy: () => void
  /** 更改机器码（写操作）；成功后自动刷新机器码展示 */
  changeMachineId: (options?: ChangeMachineIdOptions) => Promise<ChangeMachineIdResult | null>
  /** 清空上次更改机器码的结果 */
  clearMachineIdChange: () => void
}

export const useReinstallStore = create<ReinstallStore>((set, get) => {
  // store 创建时订阅一次部署进度推送（应用生命周期内常驻）
  window.electronAPI.onReinstallProgress((p) => {
    set({ deployProgress: p, deploying: !p.done })
  })

  return {
    sources: null,
    machineId: null,
    loading: false,
    error: null,
    loaded: false,
    importing: false,
    lastImport: null,
    deploying: false,
    deployProgress: null,
    changingMachineId: false,
    lastMachineIdChange: null,
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
    startDeploy: async (sourceId) => {
      if (get().deploying) return
      // 进度由 onReinstallProgress 推送写入；这里仅置初始态并触发主进程流水线
      set({ deploying: true, deployProgress: { percent: 0, stage: '正在启动部署流程' } })
      try {
        await window.electronAPI.startReinstallDeploy(sourceId)
        // 本期为演示流水线，正常结束即收尾（进度终态由事件标注 done）
      } catch (err) {
        set({ deploying: false })
        toast.error('启动部署失败', errorMessage(err))
      }
    },
    resetDeploy: () => set({ deploying: false, deployProgress: null }),
    changeMachineId: async (options) => {
      if (get().changingMachineId) return null
      set({ changingMachineId: true })
      try {
        const result = await window.electronAPI.changeMachineId(options)
        set({ lastMachineIdChange: result })
        if (result.success) {
          // 改写成功后刷新机器码展示（复用 getMachineId）
          try {
            const machineId = await window.electronAPI.getMachineId()
            set({ machineId })
          } catch {
            // 刷新失败不影响主流程，下次进入页面会重新加载
          }
          toast.success('机器码已更新', '建议尽快重启以使其完全生效')
        } else {
          toast.error('更改机器码未生效', '请查看详情中的告警信息')
        }
        return result
      } catch (err) {
        toast.error('更改机器码失败', errorMessage(err))
        return null
      } finally {
        set({ changingMachineId: false })
      }
    },
    clearMachineIdChange: () => set({ lastMachineIdChange: null }),
  }
})
