import { describe, expect, it } from 'vitest'
import { buildGpuTweakCatalog } from '@shared/types/gpu'

describe('buildGpuTweakCatalog', () => {
  it('NVIDIA 主显卡时应支持全部基础调节项', () => {
    const options = buildGpuTweakCatalog('NVIDIA')
    expect(options).toHaveLength(4)
    expect(options.every((item) => item.available)).toBe(true)
  })

  it('非 NVIDIA 设备应仅禁用 NVIDIA 专属项', () => {
    const options = buildGpuTweakCatalog('AMD')
    const nvidia = options.find((item) => item.id === 'nvidia-low-latency')
    const others = options.filter((item) => item.id !== 'nvidia-low-latency')

    expect(nvidia?.available).toBe(false)
    expect(nvidia?.availabilityReason).toContain('仅 NVIDIA')
    expect(others.every((item) => item.available)).toBe(true)
  })
})
