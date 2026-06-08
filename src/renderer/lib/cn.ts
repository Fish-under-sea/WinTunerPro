/**
 * 轻量 className 合并工具（无第三方依赖）。
 * 过滤掉假值，拼接为空格分隔的字符串，便于条件式拼类名。
 */
export type ClassValue = string | number | false | null | undefined

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}
