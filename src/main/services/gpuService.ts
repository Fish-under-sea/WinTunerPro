import type {
  GpuApplyResult,
  GpuTweakApplyResult,
  GpuTweakExecutionResult,
  GpuTweakOption,
  GpuTweakOptionId,
  GpuDetectResult,
  GpuInfo,
  GpuVendor,
  NvidiaPresetId,
  NvidiaProfileStatus,
} from '@shared/types/gpu'
import { buildGpuTweakCatalog } from '@shared/types/gpu'
import { runPowerShell, asArray } from './powershellRunner'
import { ensurePerformancePlan } from './powerService'

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

interface RawGpuApplyResult {
  success?: unknown
  vendor?: unknown
  presetId?: unknown
  applied?: unknown
  backupPath?: unknown
  warnings?: unknown
  message?: unknown
}

interface RawGpuBatchItemResult {
  id?: unknown
  status?: unknown
  reason?: unknown
}

interface RawGpuBatchApplyResult {
  success?: unknown
  summary?: unknown
  warnings?: unknown
  results?: unknown
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

/** 获取可执行调优项（附可用性） */
export async function listGpuTweakOptions(): Promise<GpuTweakOption[]> {
  const detect = await detectGpu()
  return buildGpuTweakCatalog(detect.primaryVendor)
}

const NVIDIA_PRESET_WHITELIST: readonly NvidiaPresetId[] = ['competitive', 'balanced', 'power-saving']

/** 应用 NVIDIA 基础预设 */
export async function applyNvidiaPreset(presetId: NvidiaPresetId): Promise<GpuApplyResult> {
  if (!NVIDIA_PRESET_WHITELIST.includes(presetId)) {
    throw new Error(`不支持的 NVIDIA 预设：${presetId}`)
  }

  const detect = await detectGpu()
  if (detect.primaryVendor !== 'NVIDIA') {
    return {
      success: false,
      vendor: detect.primaryVendor,
      presetId,
      applied: false,
      warnings: ['当前设备主显卡并非 NVIDIA，已跳过 NVIDIA 预设下发'],
      message: '仅 NVIDIA 设备支持该预设',
    }
  }

  const raw = await runPowerShell<RawGpuApplyResult>('gpu/Set-NvidiaPreset.ps1', ['-PresetId', presetId])
  const warnings = asArray<string>(raw.warnings).map((w) => String(w))
  const result: GpuApplyResult = {
    success: Boolean(raw.success),
    vendor: normalizeVendor(raw.vendor),
    presetId: NVIDIA_PRESET_WHITELIST.includes(String(raw.presetId) as NvidiaPresetId)
      ? (raw.presetId as NvidiaPresetId)
      : presetId,
    applied: Boolean(raw.applied),
    backupPath: String(raw.backupPath ?? '') || undefined,
    warnings,
    message: String(raw.message ?? ''),
  }

  // 竞争档位额外兜底为卓越性能电源方案，确保“点按钮即生效”。
  if (presetId === 'competitive' && result.success) {
    const plan = await ensurePerformancePlan('ultimate')
    result.warnings = [
      ...result.warnings,
      `已联动切换电源计划：${plan.name}（${plan.guid}）`,
    ]
  }

  return result
}

const GPU_TWEAK_WHITELIST: readonly GpuTweakOptionId[] = [
  'nvidia-low-latency',
  'enable-hags',
  'enable-game-mode',
  'power-plan-performance',
  'nvidia-profile',
]

interface RawNvidiaProfileStatus {
  imageSettingsMode?: unknown
  imageSettingsValue?: unknown
  openGLGpu?: unknown
  powerMizerLevel?: unknown
  preferredRefreshRate?: unknown
  targetImageMode?: unknown
  targetImageValue?: unknown
  targetPowerLevel?: unknown
  targetRefreshRate?: unknown
}

function normalizeNvidiaProfileStatus(raw: RawNvidiaProfileStatus): NvidiaProfileStatus {
  return {
    imageSettingsMode: Number(raw.imageSettingsMode ?? -1),
    imageSettingsValue: Number(raw.imageSettingsValue ?? -1),
    openGLGpu: String(raw.openGLGpu ?? ''),
    powerMizerLevel: Number(raw.powerMizerLevel ?? -1),
    preferredRefreshRate: Number(raw.preferredRefreshRate ?? -1),
    targetImageMode: Number(raw.targetImageMode ?? 2),
    targetImageValue: Number(raw.targetImageValue ?? 0),
    targetPowerLevel: Number(raw.targetPowerLevel ?? 1),
    targetRefreshRate: Number(raw.targetRefreshRate ?? 1),
  }
}

/** 只读查询 NVIDIA 控制面板竞技预设当前状态 */
export async function getNvidiaProfileStatus(): Promise<NvidiaProfileStatus> {
  const detect = await detectGpu()
  if (detect.primaryVendor !== 'NVIDIA') {
    throw new Error('仅 NVIDIA 主显卡支持查询控制面板预设状态')
  }
  const raw = await runPowerShell<RawNvidiaProfileStatus>('gpu/Get-NvidiaProfileStatus.ps1')
  return normalizeNvidiaProfileStatus(raw)
}

function normalizeTweakResult(raw: RawGpuBatchItemResult): GpuTweakExecutionResult {
  const id = String(raw.id ?? '') as GpuTweakOptionId
  const status = String(raw.status ?? '')
  return {
    id,
    status: status === 'success' || status === 'failed' || status === 'skipped' ? status : 'failed',
    reason: String(raw.reason ?? ''),
  }
}

/** 批量应用显卡调优项（每项返回 success/failed/skipped + 原因） */
export async function applyGpuTweaks(optionIds: GpuTweakOptionId[]): Promise<GpuTweakApplyResult> {
  if (!Array.isArray(optionIds) || optionIds.length === 0) {
    return {
      success: false,
      summary: '未选择任何调节项',
      warnings: [],
      results: [],
    }
  }

  const ids = [...new Set(optionIds.filter((id): id is GpuTweakOptionId => GPU_TWEAK_WHITELIST.includes(id)))]
  if (ids.length === 0) {
    throw new Error('没有命中可执行的显卡调节项，已拒绝执行')
  }

  const raw = await runPowerShell<RawGpuBatchApplyResult>('gpu/Apply-GpuTweaks.ps1', [
    '-OptionIds',
    ids.join(','),
  ])

  return {
    success: Boolean(raw.success),
    summary: String(raw.summary ?? ''),
    warnings: asArray<string>(raw.warnings).map((w) => String(w)),
    results: asArray<RawGpuBatchItemResult>(raw.results).map(normalizeTweakResult),
  }
}
