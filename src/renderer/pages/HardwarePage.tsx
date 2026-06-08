import { useEffect } from 'react'
import { useHardwareStore } from '@renderer/store/hardwareStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import { PageHeader, SectionCard, InfoList, Tag, Skeleton, Button } from '@renderer/components/ui'
import type { InfoRow } from '@renderer/components/ui'
import { formatBytes, orDash } from '@renderer/lib/format'

/**
 * 硬件信息页：分组展示系统、处理器、内存、主板、存储等只读信息。
 * 数据来自 getSystemInfo + getDeviceInfo（mock 真数据）。
 */
export function HardwarePage(): React.JSX.Element {
  const { systemInfo, deviceInfo, loading, error, loaded, load } = useHardwareStore()

  useEffect(() => {
    void load()
  }, [load])

  const osRows: InfoRow[] = [
    { label: '操作系统', value: orDash(systemInfo?.osName) },
    { label: '版本', value: orDash(systemInfo?.osVersion) },
    { label: '内部版本号', value: orDash(systemInfo?.buildNumber) },
    { label: '版本分支', value: orDash(systemInfo?.edition) },
    {
      label: '激活状态',
      value: systemInfo ? (
        <Tag tone={systemInfo.activated ? 'success' : 'warning'} dot>
          {systemInfo.activated ? '已激活' : '未激活'}
        </Tag>
      ) : (
        orDash(undefined)
      ),
    },
  ]

  const deviceRows: InfoRow[] = [
    { label: '整机品牌', value: orDash(deviceInfo?.manufacturer) },
    { label: '机型型号', value: orDash(deviceInfo?.model) },
    { label: '主板型号', value: orDash(deviceInfo?.motherboard) },
  ]

  const cpuRows: InfoRow[] = [
    { label: '处理器', value: orDash(deviceInfo?.cpuName) },
    { label: '物理核心', value: deviceInfo ? `${deviceInfo.cpuCores} 核` : orDash(undefined) },
    { label: '逻辑线程', value: deviceInfo ? `${deviceInfo.cpuThreads} 线程` : orDash(undefined) },
  ]

  const memoryRows: InfoRow[] = [
    {
      label: '内存总量',
      value: deviceInfo ? formatBytes(deviceInfo.memoryTotalBytes) : orDash(undefined),
    },
    { label: '内存插槽', value: deviceInfo ? `${deviceInfo.memorySlots} 个` : orDash(undefined) },
  ]

  return (
    <div>
      <PageHeader
        icon="cpu"
        title="硬件信息"
        description="通过 WMI 读取本机的处理器、内存、主板、磁盘与操作系统信息，作为后续调优与重装的依据。"
        action={
          <Button
            variant="outline"
            size="sm"
            leftIcon="refresh"
            loading={loading && loaded}
            onClick={() => void load(true)}
          >
            刷新
          </Button>
        }
      />

      <AsyncBoundary
        loading={loading && !loaded}
        error={error}
        onRetry={() => void load(true)}
        skeleton={<HardwareSkeleton />}
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard icon="windows" title="操作系统">
            <InfoList rows={osRows} />
          </SectionCard>

          <SectionCard icon="board" title="设备与主板">
            <InfoList rows={deviceRows} />
          </SectionCard>

          <SectionCard icon="cpu" title="处理器">
            <InfoList rows={cpuRows} />
          </SectionCard>

          <SectionCard icon="memory" title="内存">
            <InfoList rows={memoryRows} />
          </SectionCard>

          <SectionCard
            icon="drive"
            title="存储设备"
            description={`共检测到 ${deviceInfo?.disks.length ?? 0} 块磁盘`}
            className="lg:col-span-2"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {deviceInfo?.disks.map((disk, i) => (
                <div
                  key={`${disk.model}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-text" title={disk.model}>
                      {disk.model}
                    </div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {formatBytes(disk.sizeBytes)}
                    </div>
                  </div>
                  <Tag tone={disk.type === 'SSD' ? 'primary' : 'neutral'}>
                    {disk.type === 'SSD'
                      ? '固态硬盘'
                      : disk.type === 'HDD'
                        ? '机械硬盘'
                        : '未知类型'}
                  </Tag>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </AsyncBoundary>
    </div>
  )
}

function HardwareSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
