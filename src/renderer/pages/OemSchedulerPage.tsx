import { useEffect, useState } from 'react'
import { useOemStore } from '@renderer/store/oemStore'
import { usePowerStore } from '@renderer/store/powerStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import {
  PageHeader,
  SectionCard,
  Card,
  Tag,
  Button,
  Skeleton,
  Modal,
} from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'
import { cn } from '@renderer/lib/cn'
import type { OemPerformanceMode } from '@shared/types'

/** 品牌性能模式选项（本期为可视化设计，下发动作后续接入品牌脚本） */
interface PerfMode {
  id: string
  name: string
  desc: string
  icon: IconName
  highlight?: boolean
}

const PERF_MODES: PerfMode[] = [
  { id: 'quiet', name: '静音省电', desc: '降低功耗与风扇噪音，适合轻办公', icon: 'power' },
  { id: 'balanced', name: '智能均衡', desc: '性能与能耗自动平衡，日常推荐', icon: 'gauge' },
  { id: 'performance', name: '高性能', desc: '释放更高功耗墙，适合多数游戏', icon: 'zap' },
  {
    id: 'beast',
    name: '狂暴模式',
    desc: '解锁最高性能上限，竞技首选',
    icon: 'sparkles',
    highlight: true,
  },
]

export function OemSchedulerPage(): React.JSX.Element {
  const { data: oem, loading, error, loaded, load, lastApplyResult } = useOemStore()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        icon="gauge"
        title="OEM 性能调度"
        description="识别整机品牌与机箱类型，主流可调度笔记本走品牌专属性能模式，其余设备走电源计划兜底。"
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
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        }
      >
        {oem && (
          <div className="space-y-5">
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon name="gauge" size={24} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-text">
                      {oem.brandDisplayName}
                    </span>
                    <Tag tone="neutral">{oem.chassis.chassisType}</Tag>
                  </div>
                  <div className="mt-0.5 text-xs text-text-muted">
                    {oem.chassis.isLaptop ? '笔记本设备' : '台式/其他设备'}
                    {oem.chassis.hasBattery ? ' · 已检测到电池' : ' · 未检测到电池'}
                  </div>
                </div>
              </div>
              <Tag tone={oem.supportsPerformanceMode ? 'success' : 'warning'} dot>
                {oem.supportsPerformanceMode ? '支持品牌性能调度' : '走电源计划兜底'}
              </Tag>
            </Card>

            {oem.supportsPerformanceMode ? (
              <BrandPerformancePanel brandName={oem.brandDisplayName} />
            ) : (
              <PowerFallbackPanel note={oem.fallbackNote} />
            )}
            {lastApplyResult && (
              <Card className="border border-border !p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-text">
                  <Icon name={lastApplyResult.success ? 'checkCircle' : 'shieldAlert'} size={16} />
                  执行结果：{lastApplyResult.message}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {lastApplyResult.usedBrandMode
                    ? '已执行品牌专属模式'
                    : lastApplyResult.usedPowerFallback
                      ? `品牌调度未执行，已切换电源兜底：${lastApplyResult.fallbackPlanName ?? '性能方案'}`
                      : '未生效'}
                </p>
                {lastApplyResult.fallbackMatch && (
                  <p className="mt-1 text-xs text-text-muted">
                    兜底目标模式：{lastApplyResult.fallbackMatch.targetMode}；实际命中：{lastApplyResult.fallbackMatch.selectedPlanName}；
                    匹配依据：{lastApplyResult.fallbackMatch.matchedKeywords.join('、') || '无关键词命中（稳妥回退）'}。
                  </p>
                )}
                {lastApplyResult.warnings.length > 0 && (
                  <p className="mt-1 text-xs text-warning">
                    原因：{lastApplyResult.warnings.join('；')}
                  </p>
                )}
              </Card>
            )}
          </div>
        )}
      </AsyncBoundary>
    </div>
  )
}

/** 主流品牌：性能模式 + MUX 直连引导 */
function BrandPerformancePanel({ brandName }: { brandName: string }): React.JSX.Element {
  const { applyMode, applying } = useOemStore()
  const [selected, setSelected] = useState('balanced')
  const [muxOpen, setMuxOpen] = useState(false)

  return (
    <>
      <SectionCard
        icon="sparkles"
        title={`${brandName} 性能模式`}
        description="一键切换品牌专属性能档位，相当于品牌管家中的性能调节，无需理解技术细节。"
        action={
          <Button
            size="sm"
            leftIcon="check"
            loading={applying}
            onClick={() => void applyMode(selected as OemPerformanceMode)}
          >
            应用所选模式
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PERF_MODES.map((mode) => {
            const active = selected === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSelected(mode.id)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-all duration-fast ease-smooth',
                  active
                    ? 'border-primary bg-primary-soft/60 shadow-sm'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    active ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-text-muted',
                  )}
                >
                  <Icon name={mode.icon} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{mode.name}</span>
                    {mode.highlight && <Tag tone="danger">竞技</Tag>}
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">{mode.desc}</p>
                </div>
                {active && <Icon name="checkCircle" size={18} className="shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        icon="monitor"
        title="MUX 独显直连"
        description="将屏幕直连独立显卡，绕过核显输出，游戏帧率与延迟更优（需重启生效）。"
        action={
          <Button
            variant="outline"
            size="sm"
            rightIcon="arrowRight"
            onClick={() => setMuxOpen(true)}
          >
            查看引导
          </Button>
        }
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-soft bg-warning-soft/40 px-4 py-3 text-xs text-text-muted">
          <Icon name="shieldAlert" size={16} className="mt-0.5 shrink-0 text-warning" />
          <span>
            切换独显直连会关闭核显输出，可能略增功耗与发热并需重启。引导式切换将在后续版本接入，届时会自动备份当前显示配置。
          </span>
        </div>
      </SectionCard>

      <Modal
        open={muxOpen}
        onClose={() => setMuxOpen(false)}
        title="MUX 独显直连引导"
        description="按以下步骤即可让屏幕直连独立显卡。"
        size="md"
        footer={
          <Button variant="outline" onClick={() => setMuxOpen(false)}>
            我知道了
          </Button>
        }
      >
        <ol className="space-y-3">
          {[
            '确认本机为支持 MUX 的双显卡笔记本（核显 + 独显）。',
            '关闭正在运行的游戏与全屏程序，保存工作。',
            '在品牌性能面板中切换为「独显直连 / 独显模式」。',
            '按提示重启电脑，使显示链路切换生效。',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-sm text-text-muted">{text}</span>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  )
}

/** 兜底：电源计划切换 */
function PowerFallbackPanel({ note }: { note: string }): React.JSX.Element {
  const { data, loading, error, loaded, applyingGuid, load, setPlan } = usePowerStore()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SectionCard
      icon="power"
      title="电源计划调度"
      description="该设备不支持品牌专属性能模式，可通过切换电源计划获得更高性能。"
    >
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-info-soft bg-info-soft/50 px-4 py-3 text-xs text-text-muted">
        <Icon name="info" size={16} className="mt-0.5 shrink-0 text-primary" />
        <span>{note || '已为该设备启用电源计划兜底方案。'}</span>
      </div>

      <AsyncBoundary
        loading={loading && !loaded}
        error={error}
        onRetry={() => void load(true)}
        skeleton={
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        {data && (
          <div className="space-y-2.5">
            {!data.canModify && (
              <div className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                <Icon name="lock" size={14} />
                当前环境限制了电源计划修改（如组策略 / OEM 锁定），切换入口已禁用。
              </div>
            )}
            {data.plans.map((plan) => {
              const active = plan.guid === data.activeGuid
              return (
                <div
                  key={plan.guid}
                  className={cn(
                    'flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors',
                    active ? 'border-primary bg-primary-soft/50' : 'border-border bg-surface',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      name="power"
                      size={18}
                      className={active ? 'text-primary' : 'text-text-subtle'}
                    />
                    <span className="text-sm font-medium text-text">{plan.name}</span>
                    {active && <Tag tone="primary">当前使用</Tag>}
                  </div>
                  {active ? (
                    <span className="text-xs text-text-subtle">已启用</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!data.canModify}
                      loading={applyingGuid === plan.guid}
                      onClick={() => void setPlan(plan.guid)}
                    >
                      切换
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </AsyncBoundary>
    </SectionCard>
  )
}
