import { useEffect, useState } from 'react'
import { useGpuStore } from '@renderer/store/gpuStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import {
  PageHeader,
  SectionCard,
  Card,
  Tag,
  Switch,
  Skeleton,
  Button,
} from '@renderer/components/ui'
import type { TagTone } from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import type { GpuVendor } from '@shared/types'
import { formatVram, orDash } from '@renderer/lib/format'
import { toast } from '@renderer/store/toastStore'

/** 厂商 → 展示名与配色 */
const VENDOR_META: Record<GpuVendor, { label: string; tone: TagTone }> = {
  NVIDIA: { label: 'NVIDIA', tone: 'success' },
  AMD: { label: 'AMD', tone: 'danger' },
  Intel: { label: 'Intel', tone: 'primary' },
  Unknown: { label: '未知厂商', tone: 'neutral' },
}

/** 竞技调优预设项（本期为 UI 设计，落地动作后续接入脚本层） */
interface PresetItem {
  id: string
  name: string
  desc: string
  recommended: boolean
}

const COMMON_PRESETS: PresetItem[] = [
  {
    id: 'low-latency',
    name: '超低延迟模式',
    desc: '关闭三重缓冲、降低预渲染帧，减少操作延迟',
    recommended: true,
  },
  {
    id: 'power-max',
    name: '电源管理：最高性能',
    desc: '锁定显卡高频运行，避免动态降频带来的帧波动',
    recommended: true,
  },
  {
    id: 'vsync-off',
    name: '关闭垂直同步',
    desc: '由游戏内自行管理同步，竞技场景优先低延迟',
    recommended: true,
  },
  {
    id: 'texture-perf',
    name: '纹理过滤：性能优先',
    desc: '牺牲少量画质换取更稳定的帧率',
    recommended: false,
  },
  {
    id: 'shader-cache',
    name: '着色器缓存优化',
    desc: '增大着色器缓存，减少卡顿与编译抖动',
    recommended: false,
  },
]

export function GpuTuningPage(): React.JSX.Element {
  const { data, loading, error, loaded, load } = useGpuStore()
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COMMON_PRESETS.map((p) => [p.id, p.recommended])),
  )

  useEffect(() => {
    void load()
  }, [load])

  const vendor = data?.primaryVendor ?? 'Unknown'
  const meta = VENDOR_META[vendor]

  return (
    <div>
      <PageHeader
        icon="gpu"
        title="显卡调优"
        description="检测显卡型号、显存与驱动，并按厂商提供竞技调优预设。当前预设为可视化设计，应用动作将在后续版本接入。"
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
                ，将据此匹配调优预设
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
            title="竞技调优预设"
            description="为低延迟竞技场景优化的显卡设置组合，可逐项开关。"
            action={
              <Button
                size="sm"
                leftIcon="check"
                onClick={() => toast.info('预设应用将在后续版本上线', '当前为可视化设计阶段')}
              >
                应用所选预设
              </Button>
            }
          >
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-info-soft bg-info-soft/50 px-4 py-3 text-xs text-text-muted">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                以下开关为本期可视化设计。落地后将通过厂商工具（NVIDIA Profile Inspector / 注册表 /
                显卡 CLI）下发， 并在写入前自动备份当前显卡配置以便还原。
              </span>
            </div>
            <div className="space-y-2.5">
              {COMMON_PRESETS.map((preset) => (
                <Card
                  key={preset.id}
                  padding="sm"
                  className="flex items-center justify-between gap-4 !rounded-xl !shadow-none"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">{preset.name}</span>
                      {preset.recommended && <Tag tone="primary">推荐</Tag>}
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">{preset.desc}</p>
                  </div>
                  <Switch
                    label={preset.name}
                    checked={enabled[preset.id] ?? false}
                    onChange={(v) => setEnabled((prev) => ({ ...prev, [preset.id]: v }))}
                  />
                </Card>
              ))}
            </div>
          </SectionCard>
        </div>
      </AsyncBoundary>
    </div>
  )
}
