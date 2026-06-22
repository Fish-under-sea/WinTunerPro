/**
 * 机器标识（MachineGuid / 遥测 MachineId）相关的纯函数工具。
 *
 * 抽离为无副作用的纯逻辑，便于单测覆盖「GUID 生成 / 格式校验」，
 * 同时供主进程 reinstallService 在调用 PowerShell 前生成并白名单校验新标识，
 * 避免把未校验的脏数据透传给写注册表的脚本（防注入、防脏写）。
 */

/** 标准 GUID 形态（与 powershellRunner.isGuid、Set-MachineId.ps1 的 $GUID_PATTERN 保持一致） */
export const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** 是否为标准 GUID 字符串（不含花括号） */
export function isStandardGuid(value: unknown): value is string {
  return typeof value === 'string' && GUID_RE.test(value)
}

/**
 * 生成一个标准 GUID（小写、无花括号），用作新的 MachineGuid。
 *
 * 优先用平台 crypto.randomUUID（Node 与现代浏览器均可用）；
 * 不可用时回退到基于 Math.random 的 RFC4122 v4 兜底实现（仅作极端环境兜底，正常路径不会触达）。
 */
export function generateGuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID().toLowerCase()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 把任意 GUID 规整为遥测 MachineId 的存储形态（花括号 + 大写）；非法输入返回 null */
export function toTelemetryIdForm(value: string): string | null {
  const stripped = value.replace(/[{}]/g, '').trim()
  if (!isStandardGuid(stripped)) return null
  return `{${stripped.toUpperCase()}}`
}
