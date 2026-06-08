import { useRef } from 'react'
import { PageHeader, SectionCard, Card, Tag, Button, Table } from '@renderer/components/ui'
import type { TableColumn, TagTone } from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import { toast } from '@renderer/store/toastStore'

/** 备份记录（本期为 UI 设计示意数据，落地后由主进程提供真实历史） */
interface BackupRecord {
  id: string
  name: string
  kind: 'restore-point' | 'reg-snapshot' | 'wtp'
  createdAt: string
  size: string
}

const KIND_META: Record<BackupRecord['kind'], { label: string; tone: TagTone }> = {
  'restore-point': { label: '系统还原点', tone: 'primary' },
  'reg-snapshot': { label: '注册表快照', tone: 'neutral' },
  wtp: { label: '配置档案', tone: 'success' },
}

const MOCK_RECORDS: BackupRecord[] = [
  {
    id: '1',
    name: '优化前自动还原点',
    kind: 'restore-point',
    createdAt: '2026-06-08 09:42',
    size: '—',
  },
  {
    id: '2',
    name: '电源与服务快照',
    kind: 'reg-snapshot',
    createdAt: '2026-06-07 21:15',
    size: '2.1 MB',
  },
  { id: '3', name: '工作室标准配置', kind: 'wtp', createdAt: '2026-06-06 14:03', size: '860 KB' },
]

export function BackupPage(): React.JSX.Element {
  const importRef = useRef<HTMLInputElement>(null)

  const columns: TableColumn<BackupRecord>[] = [
    {
      header: '名称',
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <Icon name="backup" size={16} className="text-text-subtle" />
          <span className="font-medium text-text">{r.name}</span>
        </div>
      ),
    },
    {
      header: '类型',
      cell: (r) => <Tag tone={KIND_META[r.kind].tone}>{KIND_META[r.kind].label}</Tag>,
    },
    { header: '创建时间', cell: (r) => <span className="text-text-muted">{r.createdAt}</span> },
    {
      header: '大小',
      align: 'right',
      cell: (r) => <span className="text-text-muted">{r.size}</span>,
    },
    {
      header: '操作',
      align: 'right',
      className: 'w-28',
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          leftIcon="refresh"
          onClick={() => toast.info('还原将在后续版本上线', r.name)}
        >
          还原
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon="backup"
        title="配置备份与迁移"
        description="为系统配置建立还原点与注册表快照，并可导出为加密的 .wtp 档案，用于跨机器批量部署。"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard
          icon="shield"
          title="备份与还原点"
          description="写系统操作前会自动建点，也可手动创建快照。"
          action={
            <Button
              size="sm"
              leftIcon="plus"
              onClick={() => toast.info('新建快照将在后续版本上线')}
            >
              新建快照
            </Button>
          }
        >
          <p className="text-sm text-text-muted">
            还原点用于回退系统级改动，注册表快照（.reg）记录具体键值，二者共同保证「可恢复」。
          </p>
        </SectionCard>

        <SectionCard
          icon="backup"
          title="配置档案（.wtp）"
          description="把当前优化配置打包为加密档案，便于在多台机器间复用。"
        >
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              block
              leftIcon="upload"
              onClick={() => toast.info('导出 .wtp 将在后续版本上线')}
            >
              导出配置
            </Button>
            <Button
              block
              variant="outline"
              leftIcon="download"
              onClick={() => importRef.current?.click()}
            >
              导入配置
            </Button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".wtp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) toast.info('导入 .wtp 将在后续版本上线', file.name)
              e.target.value = ''
            }}
          />
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-text-muted">
            <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-text-subtle" />
            <span>.wtp 档案采用加密存储，仅包含优化配置，不含任何激活或授权信息。</span>
          </div>
        </SectionCard>
      </div>

      <Card padding="none" className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-text">备份历史</h3>
          <Tag tone="neutral">{MOCK_RECORDS.length} 条记录</Tag>
        </div>
        <div className="p-5">
          <Table columns={columns} rows={MOCK_RECORDS} rowKey={(r) => r.id} />
          <p className="mt-3 text-xs text-text-subtle">
            以上为示意数据，接入主进程后将展示真实的备份历史。
          </p>
        </div>
      </Card>
    </div>
  )
}
