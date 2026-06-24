import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { NEXUS_PRESET_BUSY_KEY, useBeautifyStore } from '@renderer/store/beautifyStore'
import type { ApplyNexusPresetFeedback } from '@renderer/store/beautifyStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import {
  PageHeader,
  SectionCard,
  Tag,
  Button,
  Skeleton,
  Progress,
} from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import { EASE_OUT } from '@renderer/lib/motion'
import type { InstallProgress, ToolInstallStatus } from '@shared/types'

export function BeautifyPage(): React.JSX.Element {
  const {
    data,
    loading,
    error,
    loaded,
    busy,
    progress,
    nexusPresetFeedback,
    load,
    installTranslucentTB,
    installNexus,
    applyNexusPreset,
  } = useBeautifyStore()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        icon="palette"
        title="系统美化"
        description="一键安装任务栏与 Dock 美化工具，并套用 Nexus UI 预设，让桌面焕然一新。"
        action={
          <Button
            variant="outline"
            size="sm"
            leftIcon="refresh"
            loading={loading && loaded}
            onClick={() => void load(true)}
          >
            刷新状态
          </Button>
        }
      />

      <AsyncBoundary
        loading={loading && !loaded}
        error={error}
        onRetry={() => void load(true)}
        skeleton={
          <div className="space-y-5">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        }
      >
        {data && (
          <div className="space-y-5">
            <SectionCard
              icon="brush"
              title="美化工具"
              description="安装后即可获得透明任务栏与 macOS 风格 Dock。"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ToolCard
                  name="TranslucentTB"
                  desc="让任务栏透明 / 模糊，简洁通透"
                  status={data.translucenttb}
                  loading={busy === 'translucenttb'}
                  disabled={busy !== null}
                  progress={progress.translucenttb}
                  onInstall={() => void installTranslucentTB()}
                />
                <ToolCard
                  name="Nexus Dock"
                  desc="桌面底部 macOS 风格程序坞"
                  status={data.nexus}
                  loading={busy === 'nexus'}
                  disabled={busy !== null}
                  progress={progress.nexus}
                  onInstall={() => void installNexus()}
                />
              </div>
            </SectionCard>

            <SectionCard
              icon="sparkles"
              title="Nexus UI 预设"
              description="以内置模板一键对齐 Nexus 的 Dock 外观与界面设置，让程序坞风格统一（不会改动你的快捷方式）。"
            >
              <NexusPresetCard
                busy={busy === NEXUS_PRESET_BUSY_KEY}
                disabled={busy !== null}
                feedback={nexusPresetFeedback}
                onApply={() => void applyNexusPreset()}
              />
            </SectionCard>
          </div>
        )}
      </AsyncBoundary>
    </div>
  )
}

/** feedback 语气 → Tag 配色（info 复用 primary，dryRun 单独走醒目蓝调） */
const FEEDBACK_TAG_TONE: Record<ApplyNexusPresetFeedback['tone'], 'primary' | 'success' | 'warning'> =
  {
    info: 'primary',
    success: 'success',
    warning: 'warning',
  }

const FEEDBACK_ICON: Record<ApplyNexusPresetFeedback['tone'], 'info' | 'check' | 'alert'> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
}

function NexusPresetCard({
  busy,
  disabled,
  feedback,
  onApply,
}: {
  busy: boolean
  disabled: boolean
  feedback: ApplyNexusPresetFeedback | null
  onApply: () => void
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon name="sparkles" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text">应用 Nexus UI 预设</div>
          <p className="mt-0.5 text-xs text-text-muted">
            一键把内置模板里的 Dock 尺寸、动效、位置、主题等界面设置套用到本机；快捷方式保持原样不动。
          </p>

          <Button
            className="mt-3"
            size="sm"
            leftIcon="sparkles"
            loading={busy}
            disabled={disabled}
            onClick={onApply}
          >
            {busy ? '正在应用…' : '应用 Nexus UI 预设'}
          </Button>

          <AnimatePresence mode="wait" initial={false}>
            {feedback && (
              <motion.div
                key={`${feedback.title}-${feedback.description ?? ''}`}
                className="mt-3 rounded-lg border border-border bg-surface p-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={FEEDBACK_TAG_TONE[feedback.tone]} icon={FEEDBACK_ICON[feedback.tone]}>
                    {feedback.title}
                  </Tag>
                  {feedback.dryRun && (
                    <Tag tone="primary" icon="info">
                      预演模式 · 确认后生效
                    </Tag>
                  )}
                </div>
                {feedback.description && (
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    {feedback.description}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ToolCard({
  name,
  desc,
  status,
  loading,
  disabled,
  progress,
  onInstall,
}: {
  name: string
  desc: string
  status: ToolInstallStatus
  loading: boolean
  disabled: boolean
  progress: InstallProgress | null
  onInstall: () => void
}): React.JSX.Element {
  // 安装进行中：用进度条 + 阶段文案 + 百分比替代「按钮转圈」
  const percent = progress ? Math.round(progress.percent) : 0
  const stage = progress?.stage ?? '准备中'

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon name="brush" size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">{name}</span>
          {status.installed ? (
            <Tag tone="success" dot>
              {status.running ? '运行中' : '已安装'}
            </Tag>
          ) : (
            <Tag tone="neutral" dot>
              未安装
            </Tag>
          )}
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{desc}</p>
        {status.installed && status.version && (
          <p className="mt-0.5 text-xs text-text-subtle">版本 {status.version}</p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div
              key="progress"
              className="mt-3"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <Icon name="download" size={13} className="text-primary" />
                  {stage}
                </span>
                <motion.span
                  key={percent}
                  className="font-mono tabular-nums text-text"
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {percent}%
                </motion.span>
              </div>
              <Progress value={percent} />
            </motion.div>
          ) : (
            <motion.div
              key="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
            >
              <Button
                className="mt-2.5"
                size="sm"
                variant={status.installed ? 'outline' : 'primary'}
                leftIcon={status.installed ? 'check' : 'download'}
                disabled={disabled || status.installed}
                onClick={onInstall}
              >
                {status.installed ? '已安装' : '安装'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
