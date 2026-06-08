import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ElectronAPI, OptimizationApplyResult, OptimizationScanResult } from '@shared/types'
import { useOptimizationStore } from '@renderer/store/optimizationStore'

function buildScanResult(): OptimizationScanResult {
  return {
    mode: 'scan',
    summary: '建议优化 1 项，已优化 0 项，不可用 0 项，未实现 0 项',
    warnings: [],
    results: [{ itemId: 'temp', status: 'recommended', message: '建议清理临时文件' }],
  }
}

function buildApplyResult(): OptimizationApplyResult {
  return {
    mode: 'apply',
    success: true,
    summary: '成功 1 项，失败 0 项，未实现 0 项',
    warnings: [],
    results: [{ itemId: 'temp', status: 'success', message: 'ok' }],
  }
}

describe('optimizationStore 扫描只读行为', () => {
  beforeEach(() => {
    useOptimizationStore.setState({
      scanning: false,
      applying: false,
      scanResults: null,
      applyResults: null,
    })
  })

  it('调用 scan 时不会触发 apply 接口', async () => {
    const scanOptimizations = vi.fn(async () => buildScanResult())
    const applyOptimizations = vi.fn(async () => buildApplyResult())
    const api = {
      scanOptimizations,
      applyOptimizations,
    } as unknown as ElectronAPI

    ;(globalThis as { window?: { electronAPI: ElectronAPI } }).window = { electronAPI: api }

    await useOptimizationStore.getState().scan(['temp'])

    expect(scanOptimizations).toHaveBeenCalledTimes(1)
    expect(applyOptimizations).not.toHaveBeenCalled()
    expect(useOptimizationStore.getState().scanResults?.mode).toBe('scan')
    expect(useOptimizationStore.getState().applyResults).toBeNull()
  })
})
