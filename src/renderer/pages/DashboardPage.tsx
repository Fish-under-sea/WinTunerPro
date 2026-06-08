import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHardwareStore } from '@renderer/store/hardwareStore'
import { useGpuStore } from '@renderer/store/gpuStore'
import { useOemStore } from '@renderer/store/oemStore'
import { usePowerStore } from '@renderer/store/powerStore'
import { PageHeader, StatCard, SectionCard, Card, Tag, Skeleton } from '@renderer/components/ui'
import type { TagTone } from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'
import { formatBytes, orDash } from '@renderer/lib/format'

/** 快捷入口配置 */
const QUICK_ENTRIES: { path: string; label: string; desc: string; icon: IconName }[] = [
  { path: '/optimization', label: '一键优化', desc: '空间回收与系统提速', icon: 'zap' },
  { path: '/gpu', label: '显卡调优', desc: '竞技预设一键切换', icon: 'gpu' },
  { path: '/oem', label: 'OEM 调度', desc: '品牌性能模式', icon: 'gauge' },
  { path: '/beautify', label: '系统美化', desc: '风格包与任务栏', icon: 'palette' },
]

export function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate()
  const hardware = useHardwareStore()
  const gpu = useGpuStore()
  const oem = useOemStore()
  const power = usePowerStore()
  // 单独取稳定的 action 引用用于副作用，避免随数据更新反复触发
  const loadHardware = useHardwareStore((s) => s.load)
  const loadGpu = useGpuStore((s) => s.load)
  const loadOem = useOemStore((s) => s.load)
  const loadPower = usePowerStore((s) => s.load)

  useEffect(() => {
    void loadHardware()
    void loadGpu()
    void loadOem()
    void loadPower()
  }, [loadHardware, loadGpu, loadOem, loadPower])

  const ready = hardware.loaded && gpu.loaded && oem.loaded && power.loaded
  const activePlan = power.data?.plans.find((p) => p.guid === power.data?.activeGuid)
  const primaryGpu = gpu.data?.gpus.find((g) => !g.isIntegrated) ?? gpu.data?.gpus[0]

  return (
    <div>
      <PageHeader
        icon="dashboard"
        title="仪表盘"
        description="一览本机状态与健康度，从这里快速进入各项优化。"
      />

      {/* 顶部概览指标 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ready ? (
          <>
            <StatCard
              icon="windows"
              tone="primary"
              label="操作系统"
              value={orDash(hardware.systemInfo?.osName)}
              hint={hardware.systemInfo?.osVersion}
            />
            <StatCard
              icon="cpu"
              tone="neutral"
              label="设备"
              value={orDash(hardware.deviceInfo?.manufacturer)}
              hint={hardware.deviceInfo?.model}
            />
            <StatCard
              icon="gpu"
              tone="success"
              label="主显卡"
              value={primaryGpu?.vendor ?? '未知'}
              hint={primaryGpu?.name}
            />
            <StatCard
              icon="power"
              tone="warning"
              label="电源计划"
              value={orDash(activePlan?.name)}
              hint={oem.data?.supportsPerformanceMode ? '支持品牌性能调度' : '电源兜底方案'}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-2xl" />
          ))
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 系统概览 */}
        <SectionCard icon="dashboard" title="系统概览" className="lg:col-span-2">
          {ready ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <OverviewRow icon="cpu" label="处理器" value={orDash(hardware.deviceInfo?.cpuName)} />
              <OverviewRow
                icon="memory"
                label="内存"
                value={
                  hardware.deviceInfo
                    ? formatBytes(hardware.deviceInfo.memoryTotalBytes)
                    : orDash(undefined)
                }
              />
              <OverviewRow
                icon="board"
                label="主板"
                value={orDash(hardware.deviceInfo?.motherboard)}
              />
              <OverviewRow
                icon="drive"
                label="磁盘"
                value={`${hardware.deviceInfo?.disks.length ?? 0} 块`}
              />
              <OverviewRow icon="gauge" label="品牌" value={orDash(oem.data?.brandDisplayName)} />
              <OverviewRow icon="gpu" label="显卡数量" value={`${gpu.data?.gpus.length ?? 0} 块`} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          )}
        </SectionCard>

        {/* 健康/状态总览 */}
        <SectionCard icon="shield" title="健康总览">
          <div className="space-y-2.5">
            <HealthItem
              label="系统激活"
              tone={hardware.systemInfo?.activated ? 'success' : 'warning'}
              text={
                hardware.systemInfo
                  ? hardware.systemInfo.activated
                    ? '已激活'
                    : '未激活'
                  : '检测中'
              }
            />
            <HealthItem
              label="显卡驱动"
              tone={primaryGpu?.driverVersion ? 'success' : 'neutral'}
              text={primaryGpu?.driverVersion ? '已安装' : '未知'}
            />
            <HealthItem
              label="性能调度"
              tone={oem.data?.supportsPerformanceMode ? 'success' : 'warning'}
              text={oem.data?.supportsPerformanceMode ? '品牌调度可用' : '电源兜底'}
            />
            <HealthItem
              label="电源计划"
              tone={power.data?.canModify ? 'success' : 'warning'}
              text={power.data?.canModify ? '可调整' : '受限'}
            />
          </div>
        </SectionCard>
      </div>

      {/* 快捷入口 */}
      <div className="mt-5">
        <h2 className="mb-3 text-sm font-semibold text-text">快捷入口</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ENTRIES.map((entry) => (
            <Card
              key={entry.path}
              interactive
              onClick={() => navigate(entry.path)}
              className="flex items-center gap-3.5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon name={entry.icon} size={22} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text">{entry.label}</div>
                <div className="mt-0.5 truncate text-xs text-text-muted">{entry.desc}</div>
              </div>
              <Icon name="chevronRight" size={18} className="ml-auto shrink-0 text-text-subtle" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function OverviewRow({
  icon,
  label,
  value,
}: {
  icon: IconName
  label: string
  value: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
      <Icon name={icon} size={18} className="shrink-0 text-text-subtle" />
      <div className="min-w-0">
        <div className="text-[11px] text-text-muted">{label}</div>
        <div className="truncate text-sm font-medium text-text" title={value}>
          {value}
        </div>
      </div>
    </div>
  )
}

function HealthItem({
  label,
  tone,
  text,
}: {
  label: string
  tone: TagTone
  text: string
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5">
      <span className="text-sm text-text-muted">{label}</span>
      <Tag tone={tone} dot>
        {text}
      </Tag>
    </div>
  )
}
