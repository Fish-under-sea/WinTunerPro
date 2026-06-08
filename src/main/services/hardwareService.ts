import type { SystemInfo, DeviceInfo, DiskInfo } from '@shared/types/hardware'
import { runPowerShell, asArray } from './powershellRunner'

/**
 * hardware 模块业务服务。
 *
 * 通过 PowerShell 脚本（scripts/system/）做只读硬件/系统检测：
 *   - SystemInfo → Get-SystemInfo.ps1（Win32_OperatingSystem + CurrentVersion 注册表 + 激活状态）
 *   - DeviceInfo → Get-DeviceInfo.ps1（Win32_ComputerSystem/Processor/PhysicalMemory/BaseBoard/DiskDrive）
 * 主进程解析脚本 JSON 信封后，按 src/shared/types/hardware.ts 收敛字段再回传渲染进程。
 */

/** 脚本返回的磁盘原始结构（容错解析） */
interface RawDisk {
  model?: unknown
  sizeBytes?: unknown
  type?: unknown
}

/** 脚本返回的设备信息原始结构（容错解析） */
interface RawDeviceInfo {
  manufacturer?: unknown
  model?: unknown
  cpuName?: unknown
  cpuCores?: unknown
  cpuThreads?: unknown
  memoryTotalBytes?: unknown
  memorySlots?: unknown
  motherboard?: unknown
  disks?: unknown
}

/** 脚本返回的系统信息原始结构（容错解析） */
interface RawSystemInfo {
  osName?: unknown
  osVersion?: unknown
  buildNumber?: unknown
  edition?: unknown
  activated?: unknown
}

/** 把脚本返回的介质类型收敛到契约枚举 */
function normalizeDiskType(value: unknown): DiskInfo['type'] {
  return value === 'SSD' || value === 'HDD' ? value : 'Unknown'
}

/** 获取操作系统信息 */
export async function getSystemInfo(): Promise<SystemInfo> {
  const raw = await runPowerShell<RawSystemInfo>('system/Get-SystemInfo.ps1')
  return {
    osName: String(raw.osName ?? ''),
    osVersion: String(raw.osVersion ?? ''),
    buildNumber: String(raw.buildNumber ?? ''),
    edition: String(raw.edition ?? ''),
    activated: Boolean(raw.activated),
  }
}

/** 获取设备硬件信息 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const raw = await runPowerShell<RawDeviceInfo>('system/Get-DeviceInfo.ps1')
  const disks: DiskInfo[] = asArray<RawDisk>(raw.disks).map((d) => ({
    model: String(d?.model ?? '未知磁盘'),
    sizeBytes: Number(d?.sizeBytes ?? 0),
    type: normalizeDiskType(d?.type),
  }))
  return {
    manufacturer: String(raw.manufacturer ?? ''),
    model: String(raw.model ?? ''),
    cpuName: String(raw.cpuName ?? ''),
    cpuCores: Number(raw.cpuCores ?? 0),
    cpuThreads: Number(raw.cpuThreads ?? 0),
    memoryTotalBytes: Number(raw.memoryTotalBytes ?? 0),
    memorySlots: Number(raw.memorySlots ?? 0),
    motherboard: String(raw.motherboard ?? ''),
    disks,
  }
}
