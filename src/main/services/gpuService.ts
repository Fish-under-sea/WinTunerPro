import type { GpuDetectResult, GpuInfo, GpuVendor } from '@shared/types/gpu'
import { runPowerShell, asArray } from './powershellRunner'

/**
 * gpu 模块业务服务。
 *
 * 通过 scripts/gpu/Get-VideoController.ps1 枚举 Win32_VideoController：
 *   - 厂商：优先 PNPDeviceID 的 VEN_ id（10DE/1002/8086），兜底名称关键字。
 *   - 显存：优先注册表 qwMemorySize（规避 AdapterRAM 32 位溢出），回退 AdapterRAM。
 *   - primaryVendor：独显优先，用于后续 N 卡/A 卡分流调优。
 * 主进程解析后按 src/shared/types/gpu.ts 收敛字段再回传。
 */

/** 脚本返回的单卡原始结构（容错解析） */
interface RawGpu {
  name?: unknown
  vendor?: unknown
  vramMB?: unknown
  driverVersion?: unknown
  isIntegrated?: unknown
}

/** 脚本返回的检测结果原始结构（容错解析） */
interface RawGpuResult {
  gpus?: unknown
  primaryVendor?: unknown
}

/** 把脚本返回的厂商字符串收敛到契约枚举 */
function normalizeVendor(value: unknown): GpuVendor {
  return value === 'NVIDIA' || value === 'AMD' || value === 'Intel' ? value : 'Unknown'
}

/** 检测显卡 */
export async function detectGpu(): Promise<GpuDetectResult> {
  const raw = await runPowerShell<RawGpuResult>('gpu/Get-VideoController.ps1')
  const gpus: GpuInfo[] = asArray<RawGpu>(raw.gpus).map((g) => ({
    name: String(g?.name ?? ''),
    vendor: normalizeVendor(g?.vendor),
    vramMB: Number(g?.vramMB ?? 0),
    driverVersion: String(g?.driverVersion ?? ''),
    isIntegrated: Boolean(g?.isIntegrated),
  }))
  return {
    gpus,
    primaryVendor: normalizeVendor(raw.primaryVendor),
  }
}
