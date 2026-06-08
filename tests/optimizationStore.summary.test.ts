import { describe, expect, it } from 'vitest'
import { summarizeOptimizationResult } from '@renderer/store/optimizationStore'
import type { OptimizationApplyResult } from '@shared/types'

describe('summarizeOptimizationResult', () => {
  it('正确统计成功与失败数量', () => {
    const result: OptimizationApplyResult = {
      mode: 'apply',
      success: false,
      summary: '',
      warnings: [],
      results: [
        { itemId: 'temp', status: 'success', message: 'ok' },
        { itemId: 'wu-cache', status: 'success', message: 'ok' },
        { itemId: 'power-ultimate', status: 'failed', message: 'fail' },
      ],
    }
    expect(summarizeOptimizationResult(result)).toBe('成功 2 项，失败 1 项')
  })
})
