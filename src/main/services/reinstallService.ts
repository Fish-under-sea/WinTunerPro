import { join } from 'node:path'
import { app } from 'electron'
import type {
  SystemImageSource,
  IsoValidationResult,
  MachineIdInfo,
  ReinstallProgress,
  ChangeMachineIdOptions,
  ChangeMachineIdResult,
} from '@shared/types/reinstall'
import { generateGuid, isStandardGuid } from '@shared/utils/machineId'
import { runPowerShell, asArray, resolveResourcesRoot } from './powershellRunner'

/** 部署进度回调签名 */
export type ReinstallProgressCb = (p: ReinstallProgress) => void

/**
 * reinstall 模块业务服务（本期仅实现只读部分）。
 *
 * - listSystemImageSources：scripts/system/Get-ImageSources.ps1 扫描离线资源目录探测内置 LTSC，
 *   未落地则 available=false；自定义 ISO 返回占位。
 * - getMachineId：scripts/system/Get-MachineId.ps1 读注册表 MachineGuid + 机器 SID（仅展示）。
 * - importIso：scripts/system/Test-IsoImage.ps1 只读挂载校验 ISO 可启动性，非破坏。
 * 注意：真实重装链路（startDeploy 的真实落地）属高危操作，须可重入、可中断恢复，
 *       写系统前落备份（仍为后续阶段，当前 startDeploy 保留演示边界）。
 */

/** 脚本返回的单个镜像来源原始结构（容错解析） */
interface RawImageSource {
  id?: unknown
  kind?: unknown
  displayName?: unknown
  available?: unknown
  path?: unknown
  sizeBytes?: unknown
  version?: unknown
}

/** 脚本返回的机器码原始结构（容错解析） */
interface RawMachineId {
  machineSid?: unknown
  machineGuid?: unknown
}

/** 把脚本返回的来源类型收敛到契约枚举 */
function normalizeImageKind(value: unknown): SystemImageSource['kind'] {
  return value === 'prebuilt-win10-ltsc' ||
    value === 'prebuilt-win11-ltsc' ||
    value === 'custom-iso'
    ? value
    : 'custom-iso'
}

/** 列出可用系统镜像来源（只读） */
export async function listSystemImageSources(): Promise<SystemImageSource[]> {
  const raw = await runPowerShell<unknown>('system/Get-ImageSources.ps1', [
    '-ResourcesDir',
    resolveResourcesRoot(),
  ])
  return asArray<RawImageSource>(raw).map((s) => {
    const path = String(s?.path ?? '')
    const source: SystemImageSource = {
      id: String(s?.id ?? ''),
      kind: normalizeImageKind(s?.kind),
      displayName: String(s?.displayName ?? ''),
      available: Boolean(s?.available),
      sizeBytes: Number(s?.sizeBytes ?? 0),
      version: String(s?.version ?? ''),
    }
    // path 为契约可选字段，仅在有值时附带
    if (path) source.path = path
    return source
  })
}

/** 脚本返回的 ISO 校验原始结构（容错解析） */
interface RawIsoValidation {
  valid?: unknown
  bootableVersion?: unknown
  errorMessage?: unknown
}

/**
 * 导入并校验自定义 ISO（只读、非破坏）。
 *
 * 通过 scripts/system/Test-IsoImage.ps1 只读挂载镜像、检查引导文件与安装映像、
 * 解析版本名后立即卸载，不向系统盘写入任何内容。校验未通过以 valid=false 正常返回。
 */
export async function importIso(path: string): Promise<IsoValidationResult> {
  if (typeof path !== 'string' || !path.trim()) {
    return { valid: false, errorMessage: '未提供有效的 ISO 路径' }
  }
  // 仅作为提示拦截：渲染层 file input 在部分环境只拿到文件名而非完整路径
  if (!/\.iso$/i.test(path)) {
    return { valid: false, errorMessage: '仅支持 .iso 镜像文件' }
  }

  const raw = await runPowerShell<RawIsoValidation>(
    'system/Test-IsoImage.ps1',
    ['-Path', path],
    180_000,
  )
  const valid = Boolean(raw.valid)
  const result: IsoValidationResult = { valid }
  const bootableVersion = String(raw.bootableVersion ?? '')
  const errorMessage = String(raw.errorMessage ?? '')
  if (valid && bootableVersion) result.bootableVersion = bootableVersion
  if (!valid) result.errorMessage = errorMessage || '镜像校验未通过'
  return result
}

/**
 * 触发系统部署。
 *
 * ⚠️ 占位/演示实现（本期 P3 不做真实无人值守落地）：
 *   真实的无人值守部署涉及 DISM 应用镜像、写引导（bcdboot）、注入应答文件（unattend.xml）、
 *   RunOnce 续执行等高危破坏性操作，须可重入/可中断恢复并强制备份，属 P3 排期。
 *   本函数仅按里程碑发出「模拟」进度（带延时），到约 95% 即以 done 收尾，
 *   全程绝不执行任何真实写系统操作，避免在开发/演示环境造成不可逆破坏。
 *
 * TODO(P3)：接入真实部署链路——
 *   校验镜像(DISM /Get-ImageInfo) → 应用镜像(DISM /Apply-Image) → 写引导(bcdboot) →
 *   配置续执行(RunOnce) → 重启。每一步前落备份、失败可回滚。
 *
 * @param _sourceId 选中的镜像来源 id（真实实现据此定位镜像；演示阶段仅透传校验非空）
 * @param onProgress 进度回调，逐阶段推送
 */
export async function startDeploy(
  _sourceId: string,
  onProgress: ReinstallProgressCb,
): Promise<void> {
  // 演示流水线的阶段里程碑（真实部署将替换为带备份/回滚的实际步骤）
  const stages: { percent: number; stage: string; delayMs: number }[] = [
    { percent: 10, stage: '校验镜像完整性', delayMs: 600 },
    { percent: 30, stage: '准备部署环境', delayMs: 800 },
    { percent: 55, stage: '写入引导配置', delayMs: 900 },
    { percent: 80, stage: '配置重启后续执行', delayMs: 800 },
    { percent: 95, stage: '即将重启进入部署', delayMs: 700 },
  ]

  for (const s of stages) {
    await new Promise((resolve) => setTimeout(resolve, s.delayMs))
    onProgress({ percent: s.percent, stage: s.stage })
  }

  // 演示流程到此收尾：明确标注，避免误导用户以为已真实部署
  onProgress({
    percent: 95,
    stage: '演示流程：真实无人值守部署将在后续版本启用',
    done: true,
  })
}

/** 读取机器码（只读展示） */
export async function getMachineId(): Promise<MachineIdInfo> {
  const raw = await runPowerShell<RawMachineId>('system/Get-MachineId.ps1')
  return {
    machineSid: String(raw.machineSid ?? ''),
    machineGuid: String(raw.machineGuid ?? ''),
  }
}

/** 应用备份目录（与 backupService 保持一致：%AppData%\WinTunerPro\backups） */
function getBackupDir(): string {
  return join(app.getPath('appData'), 'WinTunerPro', 'backups')
}

/** Set-MachineId.ps1 返回的原始结构（容错解析） */
interface RawChangeMachineId {
  oldMachineGuid?: unknown
  newMachineGuid?: unknown
  telemetryReset?: unknown
  oldTelemetryId?: unknown
  newTelemetryId?: unknown
  backupPath?: unknown
  requiresRestart?: unknown
  warnings?: unknown
}

/**
 * 更改机器码（合法的机器标识重置，写操作）。
 *
 * 合规与安全（见 project-overview.mdc 红线）：
 *   - 仅重新生成软件层注册表标识：MachineGuid（必做）+ 可选遥测 MachineId（SQMClient）。
 *   - 绝不伪造任何硬件指纹（磁盘序列号 / 网卡 MAC / 主板·CPU ID），也不做反作弊绕过。
 *   - 主进程在此生成新 GUID 并做白名单校验后再传给脚本，脚本写前导出 .reg 快照（可回滚）。
 *
 * @param options.resetTelemetryId 是否一并重置遥测 MachineId（更高风险，默认 false）
 * @returns 含旧值/新值/备份路径/是否需重启/告警的结构化结果
 */
export async function changeMachineId(
  options: ChangeMachineIdOptions = {},
): Promise<ChangeMachineIdResult> {
  // 主进程侧生成并校验新 GUID，确保传入脚本的是干净的标准 GUID（防注入/防脏写）
  const newGuid = generateGuid()
  if (!isStandardGuid(newGuid)) {
    throw new Error('内部错误：生成的新 MachineGuid 非法，已中止')
  }

  const args = ['-BackupDir', getBackupDir(), '-NewGuid', newGuid]
  if (options.resetTelemetryId) {
    // 遥测新 GUID 同样在主进程生成校验；脚本会规整为花括号大写形态
    const telGuid = generateGuid()
    if (!isStandardGuid(telGuid)) {
      throw new Error('内部错误：生成的新遥测 MachineId 非法，已中止')
    }
    args.push('-ResetTelemetryId', '-NewTelemetryId', telGuid)
  }

  const raw = await runPowerShell<RawChangeMachineId>('system/Set-MachineId.ps1', args, 60_000)

  const resolvedNewGuid = String(raw.newMachineGuid ?? '')
  return {
    success: isStandardGuid(resolvedNewGuid),
    oldMachineGuid: String(raw.oldMachineGuid ?? ''),
    newMachineGuid: resolvedNewGuid,
    telemetryReset: Boolean(raw.telemetryReset),
    oldTelemetryId: String(raw.oldTelemetryId ?? '') || undefined,
    newTelemetryId: String(raw.newTelemetryId ?? '') || undefined,
    backupPath: String(raw.backupPath ?? ''),
    requiresRestart: raw.requiresRestart === undefined ? true : Boolean(raw.requiresRestart),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map((w) => String(w)) : [],
  }
}
