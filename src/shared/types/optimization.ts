/**
 * optimization 模块共享类型——系统优化（白名单可执行项）。
 */

/** 可执行优化项白名单 */
export type OptimizationItemId =
  | 'temp'
  | 'recycle'
  | 'wu-cache'
  | 'fileext'
  | 'power-ultimate'
  | 'winsxs'
  | 'resetbase'
  | 'startup'
  | 'diagtrack'
  | 'ceip'
  | 'autoplay'
  | 'telemetry'
  | 'xbox'
  | 'news'
  | 'tips'

/** 单项执行结果 */
export interface OptimizationItemResult {
  itemId: OptimizationItemId
  status: 'success' | 'failed' | 'skipped' | 'unimplemented'
  message: string
  warning?: string
}

/** 单项体检状态 */
export type OptimizationScanStatus = 'recommended' | 'optimized' | 'unimplemented' | 'unavailable'

/** 单项体检结果 */
export interface OptimizationScanItemResult {
  itemId: OptimizationItemId
  status: OptimizationScanStatus
  message: string
  warning?: string
}

/** 批量体检结果（`optimization:scan`） */
export interface OptimizationScanResult {
  mode: 'scan'
  summary: string
  warnings: string[]
  results: OptimizationScanItemResult[]
}

/** 批量执行结果（`optimization:apply`） */
export interface OptimizationApplyResult {
  mode: 'apply'
  success: boolean
  summary: string
  warnings: string[]
  results: OptimizationItemResult[]
}
