import { useEffect, useMemo, useState } from 'react'
import { PageHeader, SectionCard, Card, Tag, Switch, Button } from '@renderer/components/ui'
import type { TagTone } from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'
import { getRecommendedOptimizationItems, useOptimizationStore } from '@renderer/store/optimizationStore'
import type { OptimizationItemId } from '@shared/types'

type Risk = 'low' | 'mid' | 'high'

interface OptItem {
  id: string
  name: string
  desc: string
  risk: Risk
  defaultOn: boolean
}

interface OptCategory {
  id: string
  title: string
  icon: IconName
  description: string
  items: OptItem[]
}

/**
 * 优化分区配置（依据 docs/dismpp-reference.md 的能力清单）。
 * 高风险项默认关闭并单独折叠；服务/Appx 采用白名单制理念。
 * 本期以分区 + 选项 + 一键入口的 UI 呈现，执行动作后续接入脚本层。
 */
const CATEGORIES: OptCategory[] = [
  {
    id: 'space',
    title: '空间回收',
    icon: 'trash',
    description: '清理临时文件、缓存与系统冗余组件，释放磁盘空间。',
    items: [
      {
        id: 'temp',
        name: '临时文件与缓存',
        desc: '清理 %TEMP%、系统 Temp、应用缓存',
        risk: 'low',
        defaultOn: true,
      },
      {
        id: 'recycle',
        name: '清空回收站',
        desc: '清理所有驱动器的回收站',
        risk: 'low',
        defaultOn: true,
      },
      {
        id: 'wu-cache',
        name: 'Windows 更新缓存',
        desc: '清理 SoftwareDistribution 下载缓存',
        risk: 'low',
        defaultOn: true,
      },
      {
        id: 'winsxs',
        name: 'WinSxS 组件清理',
        desc: '清理已被取代的旧版系统组件',
        risk: 'mid',
        defaultOn: true,
      },
      {
        id: 'resetbase',
        name: 'WinSxS 深度清理（ResetBase）',
        desc: '执行后将无法卸载已安装的更新',
        risk: 'high',
        defaultOn: false,
      },
    ],
  },
  {
    id: 'service',
    title: '服务与启动项',
    icon: 'list',
    description: '按白名单精简非必要的服务、计划任务与开机自启项。',
    items: [
      {
        id: 'startup',
        name: '精简开机启动项',
        desc: '禁用拖慢开机的非必要自启程序',
        risk: 'low',
        defaultOn: true,
      },
      {
        id: 'diagtrack',
        name: '禁用诊断跟踪服务',
        desc: '关闭 DiagTrack 遥测服务（可逆）',
        risk: 'mid',
        defaultOn: true,
      },
      {
        id: 'ceip',
        name: '关闭客户体验改善任务',
        desc: '禁用 CEIP 相关计划任务',
        risk: 'mid',
        defaultOn: true,
      },
    ],
  },
  {
    id: 'privacy',
    title: '隐私与体验',
    icon: 'shield',
    description: '调整资源管理器体验与隐私相关注册表开关。',
    items: [
      {
        id: 'fileext',
        name: '显示文件扩展名',
        desc: '在资源管理器中始终显示扩展名',
        risk: 'low',
        defaultOn: true,
      },
      {
        id: 'autoplay',
        name: '关闭自动播放',
        desc: '插入设备时不自动执行',
        risk: 'low',
        defaultOn: false,
      },
      {
        id: 'telemetry',
        name: '降低遥测等级',
        desc: '将诊断数据收集降至最低（保留必要安全项）',
        risk: 'mid',
        defaultOn: true,
      },
    ],
  },
  {
    id: 'appx',
    title: 'Appx 应用清理',
    icon: 'trash',
    description: '按白名单卸载内置冗余应用（仅安全项，禁止全选）。',
    items: [
      {
        id: 'xbox',
        name: 'Xbox 游戏录制组件',
        desc: '卸载 Xbox Game Bar 等组件',
        risk: 'mid',
        defaultOn: false,
      },
      {
        id: 'news',
        name: '资讯与天气',
        desc: '卸载内置资讯磁贴应用',
        risk: 'low',
        defaultOn: false,
      },
      {
        id: 'tips',
        name: '使用技巧（Tips）',
        desc: '卸载系统提示应用',
        risk: 'low',
        defaultOn: false,
      },
    ],
  },
]

const RISK_META: Record<Risk, { label: string; tone: TagTone }> = {
  low: { label: '低风险', tone: 'success' },
  mid: { label: '中风险', tone: 'warning' },
  high: { label: '高风险', tone: 'danger' },
}

const SCAN_STATUS_META: Record<
  'recommended' | 'optimized' | 'unimplemented' | 'unavailable',
  { label: string; tone: TagTone }
> = {
  recommended: { label: '建议优化', tone: 'warning' },
  optimized: { label: '已优化', tone: 'success' },
  unimplemented: { label: '未实现', tone: 'neutral' },
  unavailable: { label: '不可用', tone: 'danger' },
}

const ALL_ITEM_IDS: OptimizationItemId[] = CATEGORIES.flatMap((cat) =>
  cat.items.map((item) => item.id as OptimizationItemId),
)

export function OptimizationPage(): React.JSX.Element {
  const { scan, apply, scanning, applying, scanResults, applyResults } = useOptimizationStore()
  const [state, setState] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const cat of CATEGORIES) for (const item of cat.items) init[item.id] = item.defaultOn
    return init
  })
  const [expertOpen, setExpertOpen] = useState<Record<string, boolean>>({})

  const selectedCount = useMemo(() => Object.values(state).filter(Boolean).length, [state])
  const selectedItems = useMemo(
    () => Object.entries(state).filter(([, v]) => v).map(([id]) => id as OptimizationItemId),
    [state],
  )

  const toggle = (id: string, v: boolean): void => setState((p) => ({ ...p, [id]: v }))

  useEffect(() => {
    if (!scanResults) return
    const recommended = new Set(getRecommendedOptimizationItems(scanResults))
    setState((prev) => {
      const next: Record<string, boolean> = {}
      for (const key of Object.keys(prev)) {
        next[key] = recommended.has(key as OptimizationItemId)
      }
      return next
    })
  }, [scanResults])

  const handleScan = (): void => {
    void scan(ALL_ITEM_IDS)
  }

  const handleApply = (): void => {
    const hasScan = Boolean(scanResults)
    const intro = hasScan
      ? '即将执行系统优化（会实际修改系统设置）。'
      : '尚未体检，仍可继续执行优化（会实际修改系统设置）。'
    const ok = window.confirm(
      `${intro}\n\n优化会执行白名单写操作（注册表/服务/缓存清理等）。\n请确认你已知晓风险并继续。`,
    )
    if (!ok) return
    void apply(selectedItems)
  }

  return (
    <div>
      <PageHeader
        icon="zap"
        title="系统优化"
        description="先体检再优化：体检只读取状态不会修改系统，优化会执行真实写入操作。"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon="shield"
              loading={scanning}
              onClick={handleScan}
            >
              开始体检
            </Button>
            <Button
              size="sm"
              leftIcon="zap"
              loading={applying}
              onClick={handleApply}
            >
              执行优化
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-info-soft bg-info-soft/50 px-4 py-3 text-xs text-text-muted">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-primary" />
        <span>
          「开始体检」仅做只读扫描，不会修改系统；「执行优化」会进行真实系统写入，执行前必须二次确认。
          当前已选择{' '}
          <span className="font-semibold text-text">{selectedCount}</span> 项。
        </span>
      </div>

      <div className="space-y-5">
        {CATEGORIES.map((cat) => {
          const normalItems = cat.items.filter((i) => i.risk !== 'high')
          const expertItems = cat.items.filter((i) => i.risk === 'high')
          const open = expertOpen[cat.id] ?? false
          return (
            <SectionCard
              key={cat.id}
              icon={cat.icon}
              title={cat.title}
              description={cat.description}
            >
              <div className="space-y-2.5">
                {normalItems.map((item) => (
                  <OptRow
                    key={item.id}
                    item={item}
                    checked={state[item.id] ?? false}
                    onChange={(v) => toggle(item.id, v)}
                  />
                ))}
              </div>

              {expertItems.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-danger-soft">
                  <button
                    type="button"
                    onClick={() => setExpertOpen((p) => ({ ...p, [cat.id]: !open }))}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 bg-danger-soft/50 px-4 py-2.5 text-left transition-colors hover:bg-danger-soft"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-danger">
                      <Icon name="shieldAlert" size={16} />
                      专家项（高风险，默认关闭）
                    </span>
                    <Icon
                      name={open ? 'chevronDown' : 'chevronRight'}
                      size={16}
                      className="text-danger"
                    />
                  </button>
                  {open && (
                    <div className="space-y-2.5 p-3">
                      {expertItems.map((item) => (
                        <OptRow
                          key={item.id}
                          item={item}
                          checked={state[item.id] ?? false}
                          onChange={(v) => toggle(item.id, v)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )
        })}
      </div>
      {scanResults && (
        <SectionCard icon="shield" title="体检结果（只读）" description={scanResults.summary} className="mt-5">
          <div className="space-y-2.5">
            {scanResults.results.map((item) => {
              const meta = SCAN_STATUS_META[item.status]
              return (
                <Card
                  key={item.itemId}
                  padding="sm"
                  className="flex items-center justify-between gap-3 !rounded-xl !shadow-none"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-text">{item.itemId}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{item.message}</p>
                    {item.warning && <p className="mt-0.5 text-xs text-warning">{item.warning}</p>}
                  </div>
                  <Tag tone={meta.tone}>{meta.label}</Tag>
                </Card>
              )
            })}
          </div>
        </SectionCard>
      )}
      {applyResults && (
        <SectionCard
          icon="list"
          title="执行结果"
          description={applyResults.summary}
          className="mt-5"
        >
          <div className="space-y-2.5">
            {applyResults.results.map((item) => (
              <Card
                key={item.itemId}
                padding="sm"
                className="flex items-center justify-between gap-3 !rounded-xl !shadow-none"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text">{item.itemId}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{item.message}</p>
                  {item.warning && <p className="mt-0.5 text-xs text-warning">{item.warning}</p>}
                </div>
                <Tag
                  tone={
                    item.status === 'success'
                      ? 'success'
                      : item.status === 'unimplemented'
                        ? 'neutral'
                        : item.status === 'skipped'
                          ? 'warning'
                          : 'danger'
                  }
                >
                  {item.status === 'success'
                    ? '成功'
                    : item.status === 'failed'
                      ? '失败'
                      : item.status === 'skipped'
                        ? '已跳过'
                        : '暂未实现'}
                </Tag>
              </Card>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function OptRow({
  item,
  checked,
  onChange,
}: {
  item: OptItem
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  const risk = RISK_META[item.risk]
  return (
    <Card padding="sm" className="flex items-center justify-between gap-4 !rounded-xl !shadow-none">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">{item.name}</span>
          <Tag tone={risk.tone}>{risk.label}</Tag>
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{item.desc}</p>
      </div>
      <Switch label={item.name} checked={checked} onChange={onChange} />
    </Card>
  )
}
