import { describe, expect, it } from 'vitest'
import { matchPowerPlanForMode, resolveFallbackModeFromOem } from '@shared/utils/powerPlanMatcher'
import type { PowerPlan } from '@shared/types'
import type { OemPerformanceMode } from '@shared/types'

describe('powerPlanMatcher', () => {
  it('狂暴模式优先匹配 Turbo 类计划', () => {
    const plans: PowerPlan[] = [
      { guid: '11111111-1111-1111-1111-111111111111', name: '平衡', isActive: false },
      { guid: '22222222-2222-2222-2222-222222222222', name: 'Turbo', isActive: true },
      { guid: '33333333-3333-3333-3333-333333333333', name: '高性能', isActive: false },
    ]

    const result = matchPowerPlanForMode({
      targetMode: 'turbo',
      plans,
      activeGuid: plans[1].guid,
    })

    expect(result.selectedPlan.guid).toBe(plans[1].guid)
    expect(result.confidence).toBe('high')
    expect(result.matchedKeywords).toContain('turbo')
  })

  it('低置信度时回退到平衡并给出 warning', () => {
    const plans: PowerPlan[] = [
      { guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: '办公模式A', isActive: false },
      { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: '平衡', isActive: true },
    ]

    const result = matchPowerPlanForMode({
      targetMode: 'performance',
      plans,
      activeGuid: plans[1].guid,
    })

    expect(result.usedSafeFallback).toBe(true)
    expect(result.selectedPlan.guid).toBe(plans[1].guid)
    expect(result.warning).toContain('未找到高置信度')
  })

  it('OEM 挡位映射符合产品语义', () => {
    const cases: Array<[OemPerformanceMode, ReturnType<typeof resolveFallbackModeFromOem>]> = [
      ['beast', 'turbo'],
      ['balanced', 'balanced'],
      ['performance', 'performance'],
      ['quiet', 'quiet'],
    ]

    for (const [mode, expected] of cases) {
      expect(resolveFallbackModeFromOem(mode)).toBe(expected)
    }
  })
})
