import { create } from 'zustand'
import type { BeautifyStatus, InstallProgress, NexusInstallResult } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

/**
 * 系统美化 store：读取工具与风格包状态（getBeautifyStatus），
 * 安装 TranslucentTB / Nexus、应用风格包（写操作）。
 * 安装期间通过 onInstallProgress 订阅主进程推送的进度，按 tool 写入 progress 供 UI 进度条读取。
 */
type ToolKey = 'translucenttb' | 'nexus'
type BusyKey = ToolKey | string

interface BeautifyStore {
  data: BeautifyStatus | null
  loading: boolean
  error: string | null
  loaded: boolean
  /** 正在进行的写操作标识（工具名或 themeId），用于按钮 loading */
  busy: BusyKey | null
  /** 安装进度（按工具），null 表示当前无进行中的安装 */
  progress: Record<ToolKey, InstallProgress | null>
  load: (force?: boolean) => Promise<void>
  installTranslucentTB: () => Promise<void>
  installNexus: () => Promise<void>
  applyTheme: (themeId: string) => Promise<void>
}

export function getNexusInstallFeedback(result: NexusInstallResult): {
  tone: 'success' | 'warning'
  title: string
  description?: string
} {
  if (result.configImported) {
    return { tone: 'success', title: 'Nexus 安装完成' }
  }
  return {
    tone: 'warning',
    title: 'Nexus 已安装，但配置未导入',
    description: '可更换 .reg 配置后重试安装',
  }
}

export const useBeautifyStore = create<BeautifyStore>((set, get) => {
  // store 创建时订阅一次主进程的安装进度推送（应用生命周期内常驻）
  window.electronAPI.onInstallProgress((p) => {
    set((state) => ({ progress: { ...state.progress, [p.tool]: p } }))
  })

  return {
    data: null,
    loading: false,
    error: null,
    loaded: false,
    busy: null,
    progress: { translucenttb: null, nexus: null },
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
      set((s) => ({
        busy: 'translucenttb',
        progress: {
          ...s.progress,
          translucenttb: { tool: 'translucenttb', percent: 0, stage: '准备中' },
        },
      }))
      try {
        await window.electronAPI.installTranslucentTB()
        toast.success('TranslucentTB 安装完成')
        await get().load(true)
      } catch (err) {
        toast.error('安装 TranslucentTB 失败', errorMessage(err))
      } finally {
        set((s) => ({ busy: null, progress: { ...s.progress, translucenttb: null } }))
      }
    },
    installNexus: async () => {
      if (get().busy) return
      set((s) => ({
        busy: 'nexus',
        progress: { ...s.progress, nexus: { tool: 'nexus', percent: 0, stage: '准备中' } },
      }))
      try {
        const result = await window.electronAPI.installNexus()
        const feedback = getNexusInstallFeedback(result)
        if (feedback.tone === 'success') toast.success(feedback.title, feedback.description)
        else toast.warning(feedback.title, feedback.description)
        if (result.warnings && result.warnings.length > 0) {
          toast.warning('Nexus 安装告警', result.warnings.join('；'))
        }
        await get().load(true)
      } catch (err) {
        toast.error('安装 Nexus 失败', errorMessage(err))
      } finally {
        set((s) => ({ busy: null, progress: { ...s.progress, nexus: null } }))
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
  }
})
