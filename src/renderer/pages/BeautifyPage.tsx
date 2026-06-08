import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useBeautifyStore } from '@renderer/store/beautifyStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import {
  PageHeader,
  SectionCard,
  Card,
  Tag,
  Button,
  Skeleton,
  Progress,
} from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import { cn } from '@renderer/lib/cn'
import { EASE_OUT } from '@renderer/lib/motion'
import type { InstallProgress, ToolInstallStatus } from '@shared/types'

/** 本地风格包清单（contract 未提供列表，预览用渐变色块示意） */
const THEME_PACKS: { id: string; name: string; desc: string; gradient: string }[] = [
  {
    id: 'cyber',
    name: '赛博朋克',
    desc: '霓虹紫青、深色科技感',
    gradient: 'from-fuchsia-500 via-purple-600 to-cyan-500',
  },
  {
    id: 'minimal',
    name: '极简清爽',
    desc: '留白通透、低饱和浅色',
    gradient: 'from-sky-300 via-blue-200 to-slate-100',
  },
  {
    id: 'esports',
    name: '电竞红',
    desc: '高对比红黑、热血竞技',
    gradient: 'from-red-500 via-rose-600 to-slate-900',
  },
]

export function BeautifyPage(): React.JSX.Element {
  const {
    data,
    loading,
    error,
    loaded,
    busy,
    progress,
    load,
    installTranslucentTB,
    installNexus,
    applyTheme,
  } = useBeautifyStore()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        icon="palette"
        title="系统美化"
        description="一键安装任务栏与 Dock 美化工具，并切换整体风格包，让桌面焕然一新。"
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
              title="风格包"
              description="一键套用壁纸、图标、任务栏样式的整体风格组合。"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {THEME_PACKS.map((pack, i) => {
                  const applied = data.currentThemeId === pack.id
                  const isBusy = busy === pack.id
                  return (
                    <motion.div
                      key={pack.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.32, delay: i * 0.05, ease: EASE_OUT }}
                      whileHover={{ y: -3 }}
                    >
                      <Card padding="none" className="overflow-hidden">
                        <div className={cn('relative h-28 bg-gradient-to-br', pack.gradient)}>
                          {applied && (
                            <span className="absolute right-2 top-2">
                              <Tag tone="success" icon="check">
                                使用中
                              </Tag>
                            </span>
                          )}
                        </div>
                        <div className="p-4">
                          <div className="text-sm font-semibold text-text">{pack.name}</div>
                          <p className="mt-0.5 text-xs text-text-muted">{pack.desc}</p>
                          <Button
                            className="mt-3"
                            size="sm"
                            block
                            variant={applied ? 'outline' : 'primary'}
                            disabled={applied || (busy !== null && !isBusy)}
                            loading={isBusy}
                            onClick={() => void applyTheme(pack.id)}
                          >
                            {applied ? '已应用' : '应用风格'}
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </SectionCard>
          </div>
        )}
      </AsyncBoundary>
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
