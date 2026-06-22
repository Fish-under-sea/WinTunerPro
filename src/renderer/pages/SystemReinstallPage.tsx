import { useEffect, useRef, useState } from 'react'
import { useReinstallStore } from '@renderer/store/reinstallStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import {
  PageHeader,
  SectionCard,
  Card,
  Tag,
  Button,
  Stepper,
  Skeleton,
  Modal,
  InfoList,
  Progress,
  Switch,
} from '@renderer/components/ui'
import type { StepItem, InfoRow } from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import type { IconName } from '@renderer/components/icons'
import type { SystemImageKind } from '@shared/types'
import { cn } from '@renderer/lib/cn'
import { formatBytes, orDash } from '@renderer/lib/format'

const STEPS: StepItem[] = [
  { title: '选择系统', description: '挑选安装来源' },
  { title: '确认备份', description: '自动建立还原点' },
  { title: '开始部署', description: '一键无人值守' },
]

const KIND_ICON: Record<SystemImageKind, IconName> = {
  'prebuilt-win10-ltsc': 'windows',
  'prebuilt-win11-ltsc': 'windows',
  'custom-iso': 'disc',
}

export function SystemReinstallPage(): React.JSX.Element {
  const {
    sources,
    machineId,
    loading,
    error,
    loaded,
    importing,
    lastImport,
    deploying,
    deployProgress,
    changingMachineId,
    lastMachineIdChange,
    load,
    importIso,
    startDeploy,
    resetDeploy,
    changeMachineId,
    clearMachineIdChange,
  } = useReinstallStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [machineModalOpen, setMachineModalOpen] = useState(false)
  // 二次确认门槛：用户须显式勾选「已了解风险」后才能执行
  const [acknowledged, setAcknowledged] = useState(false)
  // 更高风险可选项：是否一并重置遥测标识（SQMClient MachineId）
  const [resetTelemetry, setResetTelemetry] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 关闭弹窗时复位表单与上次结果，避免下次打开残留状态
  const closeMachineModal = (): void => {
    setMachineModalOpen(false)
    setAcknowledged(false)
    setResetTelemetry(false)
    clearMachineIdChange()
  }

  const handleConfirmChange = async (): Promise<void> => {
    await changeMachineId({ resetTelemetryId: resetTelemetry })
  }

  useEffect(() => {
    void load()
  }, [load])

  // 部署进度驱动顶部步骤指示：有进度即进入「开始部署」步
  const currentStep = deployProgress ? 2 : 0
  const deployDone = deployProgress?.done ?? false

  const handlePickIso = (): void => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    // Electron 渲染进程下 File 对象可能携带本地 path；缺省时退回文件名，交由主进程校验
    const path = (file as File & { path?: string }).path ?? file.name
    void importIso(path)
    e.target.value = ''
  }

  const machineRows: InfoRow[] = [
    {
      label: 'MachineGuid',
      value: <span className="font-mono text-xs">{orDash(machineId?.machineGuid)}</span>,
    },
    {
      label: '机器 SID',
      value: <span className="font-mono text-xs">{orDash(machineId?.machineSid)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        icon="reinstall"
        title="系统重装"
        description="纯软方案、全程引导，无需 PE 盘。选择系统来源即可开始，重装前会自动备份关键配置。"
      />

      <Card className="mb-5">
        <Stepper steps={STEPS} current={currentStep} />
      </Card>

      <AsyncBoundary
        loading={loading && !loaded}
        error={error}
        onRetry={() => void load(true)}
        skeleton={
          <div className="space-y-5">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        }
      >
        <div className="space-y-5">
          <SectionCard
            icon="disc"
            title="第一步 · 选择系统来源"
            description="内置 LTSC 镜像开箱即用，也可导入自定义 ISO（将自动校验可启动性）。"
            action={
              <Button
                size="sm"
                rightIcon="arrowRight"
                disabled={!selected || deploying}
                loading={deploying}
                onClick={() => selected && void startDeploy(selected)}
              >
                开始部署
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {sources?.map((src) => {
                const active = selected === src.id
                const isCustom = src.kind === 'custom-iso'
                return (
                  <div
                    key={src.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(src.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(src.id)}
                    className={cn(
                      'flex cursor-pointer flex-col rounded-xl border p-4 transition-all duration-fast ease-smooth',
                      active
                        ? 'border-primary bg-primary-soft/50 shadow-sm'
                        : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          active
                            ? 'bg-primary text-primary-contrast'
                            : 'bg-surface-2 text-text-muted',
                        )}
                      >
                        <Icon name={KIND_ICON[src.kind]} size={20} />
                      </span>
                      {active && <Icon name="checkCircle" size={18} className="text-primary" />}
                    </div>
                    <div className="mt-3 text-sm font-semibold text-text">{src.displayName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span>{src.version}</span>
                      {src.sizeBytes > 0 && (
                        <>
                          <span className="text-text-subtle">·</span>
                          <span>{formatBytes(src.sizeBytes)}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-3">
                      <Tag tone={src.available ? 'success' : 'warning'} dot>
                        {src.available ? '就绪可用' : isCustom ? '待导入' : '未就绪'}
                      </Tag>
                    </div>

                    {isCustom && (
                      <div className="mt-3 border-t border-border pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          block
                          leftIcon="folder"
                          loading={importing}
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePickIso()
                          }}
                        >
                          选择 ISO 文件
                        </Button>
                        {lastImport && (
                          <div
                            className={cn(
                              'mt-2 flex items-start gap-1.5 text-xs',
                              lastImport.valid ? 'text-success' : 'text-danger',
                            )}
                          >
                            <Icon
                              name={lastImport.valid ? 'checkCircle' : 'alert'}
                              size={14}
                              className="mt-0.5 shrink-0"
                            />
                            <span>
                              {lastImport.valid
                                ? `校验通过：${lastImport.bootableVersion ?? '可启动镜像'}`
                                : (lastImport.errorMessage ?? '镜像校验未通过')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".iso"
              className="hidden"
              onChange={handleFileChange}
            />
          </SectionCard>

          {deployProgress && (
            <SectionCard
              icon="reinstall"
              title="第三步 · 部署进度"
              description="实时展示部署各阶段进度。"
              action={
                deployDone ? (
                  <Button size="sm" variant="outline" leftIcon="refresh" onClick={resetDeploy}>
                    重新选择
                  </Button>
                ) : undefined
              }
            >
              <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-warning-soft bg-warning-soft/40 px-4 py-3 text-xs text-text-muted">
                <Icon name="shieldAlert" size={16} className="mt-0.5 shrink-0 text-warning" />
                <span>
                  当前为<span className="font-semibold text-text">演示流程</span>
                  ，不会对本机执行任何真实写系统操作。真实无人值守部署（DISM 应用镜像 + 引导写入 +
                  重启续执行）将在后续版本上线。
                </span>
              </div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-text-muted">
                  {!deployDone && (
                    <Icon name="reinstall" size={15} className="animate-spin text-primary" />
                  )}
                  {deployDone && <Icon name="checkCircle" size={15} className="text-success" />}
                  {deployProgress.stage}
                </span>
                <span className="font-mono tabular-nums text-text">
                  {Math.round(deployProgress.percent)}%
                </span>
              </div>
              <Progress value={deployProgress.percent} tone={deployDone ? 'success' : 'primary'} />
            </SectionCard>
          )}

          <SectionCard
            icon="fingerprint"
            title="更改机器码"
            description="重新生成本机的 MachineGuid（等价于重装/重置后获得的新系统标识），用于批量部署后的去重。"
            action={
              <Button
                variant="outline"
                size="sm"
                leftIcon="refresh"
                onClick={() => setMachineModalOpen(true)}
              >
                更改机器码
              </Button>
            }
          >
            <InfoList rows={machineRows} columns={2} />
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning-soft bg-warning-soft/40 px-4 py-3 text-xs text-text-muted">
              <Icon name="shieldAlert" size={16} className="mt-0.5 shrink-0 text-warning" />
              <span>
                更改机器码会影响依赖机器标识的软件授权与激活状态，属高风险操作，且需重启后完全生效。落地前会强制备份注册表（生成可一键还原的
                .reg），并需二次确认。仅重置软件层标识，不涉及任何硬件信息。
              </span>
            </div>
          </SectionCard>
        </div>
      </AsyncBoundary>

      <Modal
        open={machineModalOpen}
        onClose={closeMachineModal}
        title="更改机器码"
        description={
          lastMachineIdChange?.success
            ? '机器码已重新生成，原值已备份为 .reg，可随时一键还原。'
            : '将为本机重新生成 MachineGuid。操作前会自动备份原注册表值，可回滚。'
        }
        footer={
          lastMachineIdChange?.success ? (
            <Button onClick={closeMachineModal}>完成</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeMachineModal} disabled={changingMachineId}>
                取消
              </Button>
              <Button
                variant="danger"
                disabled={!acknowledged || changingMachineId}
                loading={changingMachineId}
                onClick={() => void handleConfirmChange()}
              >
                确认更改机器码
              </Button>
            </>
          )
        }
      >
        {lastMachineIdChange?.success ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
              <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0" />
              <span>机器码已成功更新，请尽快重启电脑以使其对所有软件完全生效。</span>
            </div>
            <InfoList
              rows={[
                {
                  label: '原 MachineGuid',
                  value: (
                    <span className="font-mono text-xs break-all">
                      {orDash(lastMachineIdChange.oldMachineGuid)}
                    </span>
                  ),
                },
                {
                  label: '新 MachineGuid',
                  value: (
                    <span className="font-mono text-xs break-all text-text">
                      {orDash(lastMachineIdChange.newMachineGuid)}
                    </span>
                  ),
                },
                ...(lastMachineIdChange.telemetryReset
                  ? [
                      {
                        label: '遥测 MachineId',
                        value: (
                          <span className="font-mono text-xs break-all">
                            {orDash(lastMachineIdChange.newTelemetryId)}
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-xs text-text-muted">
              <div className="mb-1 font-medium text-text">备份文件（用于一键还原）</div>
              <span className="font-mono break-all">{orDash(lastMachineIdChange.backupPath)}</span>
            </div>
            {lastMachineIdChange.warnings.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-warning-soft bg-warning-soft/40 px-4 py-3 text-xs text-text-muted">
                <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-warning" />
                <ul className="list-disc space-y-1 pl-4">
                  {lastMachineIdChange.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              <span>
                更改机器码可能导致部分软件（如已激活的付费软件）需要重新授权，且需<span className="font-semibold">
                  重启
                </span>
                后才能完全生效。操作仅重置软件层注册表标识，不会修改任何硬件信息。
              </span>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 px-4 py-3 text-xs text-text-muted">
              <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                执行前会自动把原注册表值导出为 .reg 备份（落在 备份目录），如需恢复可在「配置备份」中还原。
              </span>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <span className="pr-4 text-sm text-text">
                同时重置遥测标识（SQMClient MachineId）
                <span className="mt-0.5 block text-xs text-text-subtle">
                  更高风险的可选项，不确定时建议保持关闭
                </span>
              </span>
              <Switch
                checked={resetTelemetry}
                onChange={setResetTelemetry}
                disabled={changingMachineId}
                label="同时重置遥测标识"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={changingMachineId}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-danger"
              />
              我已了解上述风险，并确认继续更改机器码
            </label>
          </div>
        )}
      </Modal>
    </div>
  )
}
