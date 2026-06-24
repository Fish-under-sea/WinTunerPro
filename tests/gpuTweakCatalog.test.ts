import { describe, expect, it } from 'vitest'
import { buildGpuTweakCatalog } from '@shared/types/gpu'

describe('buildGpuTweakCatalog', () => {
  it('NVIDIA 主显卡时应支持全部基础调节项', () => {
    const options = buildGpuTweakCatalog('NVIDIA')
    expect(options).toHaveLength(5)
    expect(options.every((item) => item.available)).toBe(true)
  })

  it('nvidia-profile 仅在 NVIDIA 主显卡时 available=true', () => {
    const catalog = buildGpuTweakCatalog('NVIDIA')
    const item = catalog.find((c) => c.id === 'nvidia-profile')
    expect(item).toBeDefined()
    expect(item!.available).toBe(true)
  })

  it('nvidia-profile 在非 NVIDIA 显卡时 available=false', () => {
    const catalog = buildGpuTweakCatalog('AMD')
    const item = catalog.find((c) => c.id === 'nvidia-profile')
    expect(item).toBeDefined()
    expect(item!.available).toBe(false)
  })

  it('非 NVIDIA 设备应仅禁用 NVIDIA 专属项', () => {
    const options = buildGpuTweakCatalog('AMD')
    const nvidiaOnly = options.filter((item) => item.id === 'nvidia-low-latency' || item.id === 'nvidia-profile')
    const others = options.filter((item) => item.id !== 'nvidia-low-latency' && item.id !== 'nvidia-profile')

    expect(nvidiaOnly.every((item) => !item.available)).toBe(true)
    expect(nvidiaOnly[0]?.availabilityReason).toContain('仅 NVIDIA')
    expect(others.every((item) => item.available)).toBe(true)
  })
})
