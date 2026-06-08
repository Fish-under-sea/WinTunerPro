import type {
  SystemImageSource,
  IsoValidationResult,
  MachineIdInfo,
  ReinstallProgress,
} from '@shared/types/reinstall'
import { runPowerShell, asArray, resolveResourcesRoot } from './powershellRunner'

/** 部署进度回调签名 */
export type ReinstallProgressCb = (p: ReinstallProgress) => void

/**
 * reinstall 模块业务服务（本期仅实现只读部分）。
 *
 * - listSystemImageSources：scripts/system/Get-ImageSources.ps1 扫描离线资源目录探测内置 LTSC，
 *   未落地则 available=false；自定义 ISO 返回占位。
 * - getMachineId：scripts/system/Get-MachineId.ps1 读注册表 MachineGuid + 机器 SID（仅展示）。
 * - importIso：ISO 导入/校验属 P3 高风险写/重活，本期保持抛未实现。
 * 注意：真实重装链路属高危操作，须可重入、可中断恢复，写系统前落备份（后续阶段实现）。
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

/** 导入并校验自定义 ISO（P3 高风险写/重活，本期不实现） */
export async function importIso(_path: string): Promise<IsoValidationResult> {
  throw new Error('未实现：reinstall importIso（P3 高风险写操作，本期不实现）')
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
