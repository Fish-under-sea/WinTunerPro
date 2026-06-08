import type { SystemImageSource, IsoValidationResult, MachineIdInfo } from '@shared/types/reinstall'
import { runPowerShell, asArray, resolveResourcesRoot } from './powershellRunner'

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

/** 读取机器码（只读展示） */
export async function getMachineId(): Promise<MachineIdInfo> {
  const raw = await runPowerShell<RawMachineId>('system/Get-MachineId.ps1')
  return {
    machineSid: String(raw.machineSid ?? ''),
    machineGuid: String(raw.machineGuid ?? ''),
  }
}
