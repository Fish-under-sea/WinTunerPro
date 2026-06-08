/**
 * 把任意异常转换为面向用户的「人话」错误文案。
 * 写操作桩当前会 reject `Error('未实现：…')`，其 message 已较可读，直接透出。
 */
export function errorMessage(err: unknown, fallback = '操作失败了，请稍后重试'): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}
