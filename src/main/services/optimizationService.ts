import type {
  OptimizationApplyResult,
  OptimizationItemId,
  OptimizationItemResult,
  OptimizationScanItemResult,
  OptimizationScanResult,
} from '@shared/types/optimization'
import { runPowerShell, asArray } from './powershellRunner'

interface RawOptimizationResult {
  mode?: unknown
  success?: unknown
  summary?: unknown
  warnings?: unknown
  results?: unknown
}

interface RawOptimizationItem {
  itemId?: unknown
  status?: unknown
  message?: unknown
  warning?: unknown
}

const OPTIMIZATION_WHITELIST: readonly OptimizationItemId[] = [
  'temp',
  'recycle',
  'wu-cache',
  'fileext',
  'power-ultimate',
  'winsxs',
  'resetbase',
  'startup',
  'diagtrack',
  'ceip',
  'autoplay',
  'telemetry',
  'xbox',
  'news',
  'tips',
]

function toItemResult(raw: RawOptimizationItem): OptimizationItemResult {
  const itemId = String(raw.itemId ?? '') as OptimizationItemId
  const status = String(raw.status ?? '')
  return {
    itemId,
    status:
      status === 'success' || status === 'failed' || status === 'skipped' || status === 'unimplemented'
        ? status
        : 'failed',
    message: String(raw.message ?? ''),
    warning: String(raw.warning ?? '') || undefined,
  }
}

function toScanItemResult(raw: RawOptimizationItem): OptimizationScanItemResult {
  const itemId = String(raw.itemId ?? '') as OptimizationItemId
  const status = String(raw.status ?? '')
  return {
    itemId,
    status:
      status === 'recommended' ||
      status === 'optimized' ||
      status === 'unimplemented' ||
      status === 'unavailable'
        ? status
        : 'unavailable',
    message: String(raw.message ?? ''),
    warning: String(raw.warning ?? '') || undefined,
  }
}

function normalizeItemIds(itemIds: OptimizationItemId[]): OptimizationItemId[] {
  const dedup = new Set<OptimizationItemId>()
  for (const id of itemIds) {
    if (OPTIMIZATION_WHITELIST.includes(id)) dedup.add(id)
  }
  return [...dedup]
}

/** 只读体检系统优化项（严禁写系统） */
export async function scanOptimizations(itemIds: OptimizationItemId[]): Promise<OptimizationScanResult> {
  const ids = normalizeItemIds(itemIds)
  if (ids.length === 0) {
    return {
      mode: 'scan',
      summary: '未选择任何可体检优化项',
      warnings: [],
      results: [],
    }
  }

  const raw = await runPowerShell<RawOptimizationResult>(
    'system/Invoke-Optimization.ps1',
    ['-Mode', 'scan', '-ItemIds', ids.join(',')],
    120_000,
  )

  return {
    mode: 'scan',
    summary: String(raw.summary ?? ''),
    warnings: asArray<string>(raw.warnings).map((w) => String(w)),
    results: asArray<RawOptimizationItem>(raw.results).map(toScanItemResult),
  }
}

/** 执行系统优化白名单项 */
export async function applyOptimizations(itemIds: OptimizationItemId[]): Promise<OptimizationApplyResult> {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return {
      mode: 'apply',
      success: false,
      summary: '未选择任何可执行优化项',
      warnings: [],
      results: [],
    }
  }

  const ids = normalizeItemIds(itemIds)
  if (ids.length === 0) {
    throw new Error('没有命中白名单优化项，已拒绝执行')
  }

  const raw = await runPowerShell<RawOptimizationResult>(
    'system/Invoke-Optimization.ps1',
    ['-Mode', 'apply', '-ItemIds', ids.join(',')],
    120_000,
  )

  return {
    mode: 'apply',
    success: Boolean(raw.success),
    summary: String(raw.summary ?? ''),
    warnings: asArray<string>(raw.warnings).map((w) => String(w)),
    results: asArray<RawOptimizationItem>(raw.results).map(toItemResult),
  }
}
