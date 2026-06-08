/**
 * 通用展示格式化工具（纯函数，无副作用）。
 */

/** 把字节数格式化为人类可读的容量字符串（如 16.0 GB） */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(exponent === 0 ? 0 : fractionDigits)} ${units[exponent]}`
}

/** 把显存（MB）格式化为可读字符串（≥1024MB 显示为 GB） */
export function formatVram(vramMB: number): string {
  if (!Number.isFinite(vramMB) || vramMB <= 0) return '未知'
  if (vramMB >= 1024) return `${(vramMB / 1024).toFixed(0)} GB`
  return `${vramMB} MB`
}

/** 占位短横线（数据缺省时统一展示） */
export const DASH = '—'

/** 取值或返回占位符 */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return DASH
  return String(value)
}
