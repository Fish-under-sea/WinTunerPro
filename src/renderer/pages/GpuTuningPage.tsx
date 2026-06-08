import { useEffect, useMemo, useState } from 'react'
import { useGpuStore } from '@renderer/store/gpuStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import { PageHeader, SectionCard, Card, Tag, Skeleton, Button } from '@renderer/components/ui'
import type { TagTone } from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import type { GpuTweakOptionId, GpuVendor } from '@shared/types'
import { formatVram, orDash } from '@renderer/lib/format'

/** 厂商 → 展示名与配色 */
const VENDOR_META: Record<GpuVendor, { label: string; tone: TagTone }> = {
  NVIDIA: { label: 'NVIDIA', tone: 'success' },
  AMD: { label: 'AMD', tone: 'danger' },
  Intel: { label: 'Intel', tone: 'primary' },
  Unknown: { label: '未知厂商', tone: 'neutral' },
}

export function GpuTuningPage(): React.JSX.Element {
  const { data, options, loading, error, loaded, load, applyTweaks, applying, lastApplyResult } = useGpuStore()
  const [selectedIds, setSelectedIds] = useState<GpuTweakOptionId[]>([])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => options.some((item) => item.id === id && item.available)))
  }, [options])

  const vendor = data?.primaryVendor ?? 'Unknown'
  const meta = VENDOR_META[vendor]
  const availableCount = useMemo(() => options.filter((item) => item.available).length, [options])

  const toggleOption = (id: GpuTweakOptionId, checked: boolean): void => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((x) => x !== id)
    })
  }

  return (
    <div>
      <PageHeader
        icon="gpu"
        title="显卡调优"
        description="按可勾选的具体调节项执行优化，每项都展示作用、利弊和可用性，并返回逐项执行结果。"
        action={
          <Button
            variant="outline"
            size="sm"
            leftIcon="refresh"
            loading={loading && loaded}
            onClick={() => void load(true)}
          >
            重新检测
          </Button>
        }
      />

      <AsyncBoundary
        loading={loading && !loaded}
        error={error}
        onRetry={() => void load(true)}
        skeleton={
          <div className="space-y-5">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        }
      >
        <div className="space-y-5">
          <SectionCard
            icon="gpu"
            title="检测到的显卡"
            description={
              <span>
                主显卡厂商：<span className="font-medium text-text">{meta.label}</span>
                ，据此判定可执行调节项
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {data?.gpus.map((gpu, i) => {
                const gpuMeta = VENDOR_META[gpu.vendor]
                return (
                  <div
                    key={`${gpu.name}-${i}`}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary shadow-xs">
                      <Icon name="gpu" size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-text" title={gpu.name}>
                          {gpu.name}
                        </span>
                        {gpu.isIntegrated && <Tag tone="neutral">核显</Tag>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        <Tag tone={gpuMeta.tone} dot>
                          {gpuMeta.label}
                        </Tag>
                        <span>显存 {formatVram(gpu.vramMB)}</span>
                        <span className="text-text-subtle">·</span>
                        <span>驱动 {orDash(gpu.driverVersion)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard
            icon="zap"
            title="显卡调节项"
            description={`可执行 ${availableCount} 项，已选择 ${selectedIds.length} 项。点击后将批量执行并逐项回传成功/失败/跳过原因。`}
            action={
              <Button
                size="sm"
                leftIcon="check"
                loading={applying}
                disabled={selectedIds.length === 0}
                onClick={() => void applyTweaks(selectedIds)}
              >
                应用所选项
              </Button>
            }
          >
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-info-soft bg-info-soft/50 px-4 py-3 text-xs text-text-muted">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                已选项会按顺序执行，单项失败不会中断整批任务；每项都会返回「成功 / 失败 / 跳过 + 原因」。
              </span>
            </div>
            <div className="space-y-2.5">
              {options.map((item) => {
                const checked = selectedIds.includes(item.id)
                return (
                  <Card
                    key={item.id}
                    padding="sm"
                    className="flex items-center justify-between gap-4 !rounded-xl !shadow-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text">{item.name}</span>
                        <Tag tone={item.available ? 'success' : 'neutral'} dot>
                          {item.available ? '支持' : '不支持'}
                        </Tag>
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">{item.description}</p>
                      <p className="mt-1 text-[11px] text-text-subtle">利弊/风险：{item.tradeoff}</p>
                      <p className="mt-1 text-[11px] text-text-subtle">可用性：{item.availabilityReason}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!item.available || applying}
                      onChange={(e) => toggleOption(item.id, e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </Card>
                )
              })}
            </div>
            {lastApplyResult && (
              <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3 text-xs text-text-muted space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-text">
                  <Icon name={lastApplyResult.success ? 'checkCircle' : 'shieldAlert'} size={16} />
                  执行结果：{lastApplyResult.summary}
                </div>
                <div className="space-y-1">
                  {lastApplyResult.results.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
                      <span className="font-medium text-text">{item.id}</span>
                      <span className="flex items-center gap-2">
                        <Tag
                          tone={
                            item.status === 'success'
                              ? 'success'
                              : item.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {item.status === 'success'
                            ? '成功'
                            : item.status === 'failed'
                              ? '失败'
                              : '跳过'}
                        </Tag>
                        <span>{item.reason}</span>
                      </span>
                    </div>
                  ))}
                </div>
                {lastApplyResult.warnings.length > 0 && (
                  <p>告警：{lastApplyResult.warnings.join('；')}</p>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </AsyncBoundary>
    </div>
  )
}
