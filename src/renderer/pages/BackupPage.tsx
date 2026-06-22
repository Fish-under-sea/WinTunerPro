import { useEffect, useState } from 'react'
import {
  PageHeader,
  SectionCard,
  Card,
  Tag,
  Button,
  Table,
  Modal,
  Skeleton,
  EmptyState,
} from '@renderer/components/ui'
import type { TableColumn, TagTone } from '@renderer/components/ui'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import { Icon } from '@renderer/components/icons'
import type { BackupKind, BackupRecord } from '@shared/types'
import { useBackupStore } from '@renderer/store/backupStore'
import { formatBytes } from '@renderer/lib/format'

const KIND_META: Record<BackupKind, { label: string; tone: TagTone }> = {
  'reg-snapshot': { label: '注册表快照', tone: 'neutral' },
  wtp: { label: '配置档案', tone: 'success' },
}

/** 把 ISO 时间格式化为本地可读字符串 */
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BackupPage(): React.JSX.Element {
  const {
    records,
    loading,
    error,
    loaded,
    busy,
    load,
    createSnapshot,
    restore,
    remove,
    exportWtp,
    importWtp,
  } = useBackupStore()
  const [confirm, setConfirm] = useState<{
    action: 'restore' | 'delete'
    record: BackupRecord
  } | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const columns: TableColumn<BackupRecord>[] = [
    {
      header: '名称',
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Icon
            name={r.kind === 'wtp' ? 'backup' : 'shield'}
            size={16}
            className="text-text-subtle"
          />
          <span className="font-medium text-text">{r.name}</span>
        </div>
      ),
    },
    {
      header: '类型',
      cell: (r) => <Tag tone={KIND_META[r.kind].tone}>{KIND_META[r.kind].label}</Tag>,
    },
    {
      header: '创建时间',
      cell: (r) => <span className="text-text-muted">{formatDateTime(r.createdAt)}</span>,
    },
    {
      header: '大小',
      align: 'right',
      cell: (r) => <span className="text-text-muted">{formatBytes(r.sizeBytes)}</span>,
    },
    {
      header: '操作',
      align: 'right',
      className: 'w-44',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            leftIcon="refresh"
            loading={busy === r.id}
            disabled={!!busy && busy !== r.id}
            onClick={() => setConfirm({ action: 'restore', record: r })}
          >
            还原
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon="trash"
            disabled={!!busy}
            onClick={() => setConfirm({ action: 'delete', record: r })}
          >
            删除
          </Button>
        </div>
      ),
    },
  ]

  const handleConfirm = async (): Promise<void> => {
    if (!confirm) return
    const { action, record } = confirm
    setConfirm(null)
    if (action === 'restore') await restore(record.id)
    else await remove(record.id)
  }

  return (
    <div>
      <PageHeader
        icon="backup"
        title="配置备份与迁移"
        description="为系统配置建立注册表快照，并可导出为加密的 .wtp 档案，用于跨机器批量部署。备份统一存放在 %AppData%\WinTunerPro\backups。"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard
          icon="shield"
          title="备份与快照"
          description="导出本工具会改动的用户级注册表键（资源管理器/桌面/自动播放/Nexus 等），可一键还原。"
          action={
            <Button
              size="sm"
              leftIcon="plus"
              loading={busy === 'snapshot'}
              disabled={!!busy && busy !== 'snapshot'}
              onClick={() => void createSnapshot()}
            >
              新建快照
            </Button>
          }
        >
          <p className="text-sm text-text-muted">
            写系统的优化/美化操作会自动建立 .reg
            备份；你也可以随时手动创建一份配置快照，所有记录都会出现在下方历史中。
          </p>
        </SectionCard>

        <SectionCard
          icon="backup"
          title="配置档案（.wtp）"
          description="把当前应用配置与注册表快照打包为单个加密档案，便于在多台机器间复用。"
        >
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              block
              leftIcon="upload"
              loading={busy === 'export'}
              disabled={!!busy && busy !== 'export'}
              onClick={() => void exportWtp()}
            >
              导出配置
            </Button>
            <Button
              block
              variant="outline"
              leftIcon="download"
              loading={busy === 'import'}
              disabled={!!busy && busy !== 'import'}
              onClick={() => void importWtp()}
            >
              导入配置
            </Button>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-text-muted">
            <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-text-subtle" />
            <span>
              .wtp 采用 AES-256-GCM 加密存储，仅含应用配置与注册表快照，不含任何激活或授权信息。
            </span>
          </div>
        </SectionCard>
      </div>

      <Card padding="none" className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-text">备份历史</h3>
          <div className="flex items-center gap-2">
            <Tag tone="neutral">{records.length} 条记录</Tag>
            <Button
              size="sm"
              variant="ghost"
              leftIcon="refresh"
              disabled={!!busy}
              onClick={() => void load(true)}
            >
              刷新
            </Button>
          </div>
        </div>
        <div className="p-5">
          <AsyncBoundary
            loading={loading && !loaded}
            error={error}
            onRetry={() => void load(true)}
            skeleton={<Skeleton className="h-40 w-full rounded-xl" />}
          >
            {records.length === 0 ? (
              <EmptyState
                icon="backup"
                title="暂无备份记录"
                description="点击「新建快照」创建第一份配置快照，或在执行系统优化/美化时自动生成备份。"
              />
            ) : (
              <Table columns={columns} rows={records} rowKey={(r) => r.id} />
            )}
          </AsyncBoundary>
        </div>
      </Card>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.action === 'restore' ? '确认还原备份' : '确认删除备份'}
        description={
          confirm?.action === 'restore'
            ? '还原会把所选快照写回注册表，操作前会自动创建一份安全快照以便回退。'
            : '删除后该备份文件将无法恢复。'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              取消
            </Button>
            <Button
              variant={confirm?.action === 'delete' ? 'danger' : 'primary'}
              onClick={() => void handleConfirm()}
            >
              {confirm?.action === 'restore' ? '确认还原' : '确认删除'}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-4 py-3 text-sm text-text-muted">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-text-subtle" />
          <span>
            目标备份：<span className="font-medium text-text">{confirm?.record.name}</span>（
            {confirm ? KIND_META[confirm.record.kind].label : ''}）
          </span>
        </div>
      </Modal>
    </div>
  )
}
