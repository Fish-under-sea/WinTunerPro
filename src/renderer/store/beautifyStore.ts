import { create } from 'zustand'
import type {
  ApplyThemeResult,
  BeautifyStatus,
  InstallProgress,
  NexusConfigImportResult,
  NexusInstallResult,
} from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

/**
 * 系统美化 store：读取工具与风格包状态（getBeautifyStatus），
 * 安装 TranslucentTB / Nexus、应用风格包（写操作）。
 * 安装期间通过 onInstallProgress 订阅主进程推送的进度，按 tool 写入 progress 供 UI 进度条读取。
 */
type ToolKey = 'translucenttb' | 'nexus'
type BusyKey = ToolKey | string

/** 「应用 Nexus UI 预设」入口的 busy 标识（与安装 Nexus 区分） */
export const NEXUS_PRESET_BUSY_KEY = 'nexus-preset'

/** 应用 Nexus UI 预设的结果反馈（供 UI 内联展示与 toast，纯函数产出便于单测） */
export interface ApplyNexusPresetFeedback {
  tone: 'success' | 'info' | 'warning'
  title: string
  description?: string
  /** 是否为预演（DryRun）：仅预演未写入注册表，UI 需醒目标注 */
  dryRun: boolean
}

interface BeautifyStore {
  data: BeautifyStatus | null
  loading: boolean
  error: string | null
  loaded: boolean
  /** 正在进行的写操作标识（工具名或 themeId），用于按钮 loading */
  busy: BusyKey | null
  /** 安装进度（按工具），null 表示当前无进行中的安装 */
  progress: Record<ToolKey, InstallProgress | null>
  /** 最近一次「应用 Nexus UI 预设」的结果反馈（null 表示尚未执行） */
  nexusPresetFeedback: ApplyNexusPresetFeedback | null
  load: (force?: boolean) => Promise<void>
  installTranslucentTB: () => Promise<void>
  installNexus: () => Promise<void>
  applyTheme: (themeId: string) => Promise<void>
  applyNexusPreset: () => Promise<void>
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

/** 风格包子项的中文标签（用于分项反馈文案） */
const THEME_STEP_LABELS: Record<keyof Omit<ApplyThemeResult, 'themeId'>, string> = {
  wallpaper: '壁纸',
  taskbar: '任务栏',
  dock: 'Dock',
}

/**
 * 由 applyTheme 的分项结果组装用户提示（纯函数，便于单测）。
 *   - 有子项失败 → warning，标题「风格包部分应用成功」，描述列出成功/失败项；
 *   - 无失败 → success，标题「风格包已应用」，描述列出已应用项（全跳过时无描述）。
 * 跳过（资源缺失）不计入失败，避免把「没放 nexus.reg」误报成应用失败。
 */
export function getApplyThemeFeedback(result: ApplyThemeResult): {
  tone: 'success' | 'warning'
  title: string
  description?: string
} {
  const steps = [
    { label: THEME_STEP_LABELS.wallpaper, step: result.wallpaper },
    { label: THEME_STEP_LABELS.taskbar, step: result.taskbar },
    { label: THEME_STEP_LABELS.dock, step: result.dock },
  ]
  const applied = steps.filter((s) => s.step.status === 'applied').map((s) => s.label)
  const failed = steps.filter((s) => s.step.status === 'failed').map((s) => s.label)

  if (failed.length === 0) {
    return {
      tone: 'success',
      title: '风格包已应用',
      description: applied.length > 0 ? `已应用：${applied.join('、')}` : undefined,
    }
  }
  return {
    tone: 'warning',
    title: '风格包部分应用成功',
    description: `成功：${applied.length > 0 ? applied.join('、') : '无'}；失败：${failed.join('、')}`,
  }
}

/**
 * 由「应用 Nexus UI 预设」的导入结果组装用户提示（纯函数，便于单测）。
 *
 * 入口以 resources/themes/nexus/wsbackup.wbk 为唯一预设源，仅对齐 UI 设置、忽略快捷方式。
 * 因 [DOCKS] 落点尚未上机验证，当前默认 DryRun（仅预演不写注册表），故分三种形态：
 *   - result === null：预设源缺失（离线包未铺设）→ warning，引导补放 wsbackup.wbk；
 *   - dryRun === true（当前默认）：→ info，标题强调「已预演」，描述给出对齐/跳过项数，
 *     并明确「未写入注册表、确认后生效」，让小白知道还没真正改系统；
 *   - configImported === true 且非 DryRun（上机验证去掉 DryRun 后）：→ success，描述给出实际写入项数。
 * 其余兜底（既未导入也非预演）按 warning 处理，避免把异常静默成成功。
 * writtenCount / plannedCount / skippedShortcutCount 缺省按 0 计。
 */
export function getApplyNexusPresetFeedback(
  result: NexusConfigImportResult | null,
): ApplyNexusPresetFeedback {
  if (result === null) {
    return {
      tone: 'warning',
      title: '未找到 Nexus 预设源',
      description: '请确认离线包是否包含 resources/themes/nexus/wsbackup.wbk 后重试。',
      dryRun: false,
    }
  }

  const planned = result.plannedCount ?? 0
  const written = result.writtenCount ?? 0
  const skipped = result.skippedShortcutCount ?? 0
  const warningSuffix =
    result.warnings && result.warnings.length > 0 ? `；注意：${result.warnings.join('；')}` : ''

  if (result.dryRun) {
    const count = planned || written
    return {
      tone: 'info',
      title: '已预演 Nexus UI 预设（未写入）',
      description: `已预演对齐 ${count} 项 UI 设置，跳过 ${skipped} 项快捷方式。当前为预演模式，尚未写入注册表；上机核对无误后即可真实生效。${warningSuffix}`,
      dryRun: true,
    }
  }

  if (result.configImported) {
    const count = written || planned
    return {
      tone: 'success',
      title: 'Nexus UI 预设已应用',
      description: `已写入 ${count} 项 UI 设置，跳过 ${skipped} 项快捷方式。${warningSuffix}`,
      dryRun: false,
    }
  }

  return {
    tone: 'warning',
    title: 'Nexus UI 预设未生效',
    description: `本次未写入任何 UI 设置，请稍后重试或查看日志。${warningSuffix}`,
    dryRun: false,
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
    nexusPresetFeedback: null,
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
        const result = await window.electronAPI.applyTheme(themeId)
        const feedback = getApplyThemeFeedback(result)
        if (feedback.tone === 'success') toast.success(feedback.title, feedback.description)
        else toast.warning(feedback.title, feedback.description)
        await get().load(true)
      } catch (err) {
        toast.error('应用风格包失败', errorMessage(err))
      } finally {
        set({ busy: null })
      }
    },
    applyNexusPreset: async () => {
      if (get().busy) return
      set({ busy: NEXUS_PRESET_BUSY_KEY })
      try {
        const result = await window.electronAPI.applyNexusPreset()
        const feedback = getApplyNexusPresetFeedback(result)
        set({ nexusPresetFeedback: feedback })
        if (feedback.tone === 'success') toast.success(feedback.title, feedback.description)
        else if (feedback.tone === 'info') toast.info(feedback.title, feedback.description)
        else toast.warning(feedback.title, feedback.description)
      } catch (err) {
        const msg = errorMessage(err)
        set({
          nexusPresetFeedback: {
            tone: 'warning',
            title: '应用 Nexus UI 预设失败',
            description: msg,
            dryRun: false,
          },
        })
        toast.error('应用 Nexus UI 预设失败', msg)
      } finally {
        set({ busy: null })
      }
    },
  }
})
