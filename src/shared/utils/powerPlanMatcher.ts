import type { OemPerformanceMode } from '@shared/types/oem'
import type { PowerPlan } from '@shared/types/power'

export type OemFallbackTargetMode = 'quiet' | 'balanced' | 'performance' | 'turbo'
export type MatchConfidence = 'high' | 'medium' | 'low'

export interface MatchPowerPlanInput {
  targetMode: OemFallbackTargetMode
  plans: PowerPlan[]
  activeGuid?: string
}

export interface MatchPowerPlanResult {
  selectedPlan: PowerPlan
  score: number
  confidence: MatchConfidence
  matchedKeywords: string[]
  usedSafeFallback: boolean
  reason: string
  warning?: string
}

interface ModeKeywordRule {
  keyword: string
  weight: number
}

const KNOWN_PLAN_LABELS: Record<string, string> = {
  '381b4222-f694-41f0-9685-ff5bb260df2e': '平衡',
  '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c': '高性能',
  'a1841308-3541-4fab-bc81-f71556f20b4a': '节能',
  'e9a42b02-d5df-448d-aa00-03f14749eb61': '卓越性能',
}

const MODE_KEYWORDS: Record<OemFallbackTargetMode, ModeKeywordRule[]> = {
  quiet: [
    { keyword: 'silent', weight: 36 },
    { keyword: 'quiet', weight: 28 },
    { keyword: '静音', weight: 32 },
    { keyword: '节能', weight: 24 },
    { keyword: '省电', weight: 24 },
    { keyword: 'power saver', weight: 30 },
    { keyword: 'battery', weight: 16 },
  ],
  balanced: [
    { keyword: 'balanced', weight: 42 },
    { keyword: '平衡', weight: 40 },
    { keyword: '智能', weight: 20 },
    { keyword: 'recommended', weight: 14 },
    { keyword: '推荐', weight: 14 },
  ],
  performance: [
    { keyword: 'performance', weight: 26 },
    { keyword: '高性能', weight: 42 },
    { keyword: 'best performance', weight: 30 },
    { keyword: 'gaming', weight: 16 },
    { keyword: '竞技', weight: 18 },
  ],
  turbo: [
    { keyword: 'turbo', weight: 62 },
    { keyword: 'beast', weight: 42 },
    { keyword: '狂暴', weight: 42 },
    { keyword: 'ultimate', weight: 30 },
    { keyword: '卓越', weight: 36 },
    { keyword: 'extreme', weight: 24 },
  ],
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function confidenceByScore(score: number): MatchConfidence {
  if (score >= 60) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

function withKnownPlanName(plan: PowerPlan): PowerPlan {
  const canonical = KNOWN_PLAN_LABELS[plan.guid.toLowerCase()]
  if (!canonical) return plan
  if (!plan.name || /[^\x00-\x7f]{2,}/.test(plan.name)) {
    return { ...plan, name: canonical }
  }
  if (/[�]/.test(plan.name)) {
    return { ...plan, name: canonical }
  }
  return plan
}

export function sanitizePowerPlanDisplayName(plan: PowerPlan): PowerPlan {
  return withKnownPlanName(plan)
}

export function resolveFallbackModeFromOem(mode: OemPerformanceMode): OemFallbackTargetMode {
  switch (mode) {
    case 'beast':
      return 'turbo'
    case 'performance':
      return 'performance'
    case 'balanced':
      return 'balanced'
    case 'quiet':
    default:
      return 'quiet'
  }
}

export function matchPowerPlanForMode(input: MatchPowerPlanInput): MatchPowerPlanResult {
  const plans = input.plans.map((p) => withKnownPlanName(p))
  if (plans.length === 0) {
    throw new Error('当前系统未检测到任何电源计划')
  }

  const rules = MODE_KEYWORDS[input.targetMode]
  const scored = plans.map((plan) => {
    const text = normalizeText(plan.name)
    const matchedKeywords: string[] = []
    let score = 0
    for (const rule of rules) {
      if (text.includes(rule.keyword)) {
        score += rule.weight
        matchedKeywords.push(rule.keyword)
      }
    }

    return { plan, score, matchedKeywords }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const confidence = confidenceByScore(best.score)
  const bestReason =
    best.matchedKeywords.length > 0
      ? `命中关键词：${best.matchedKeywords.join('、')}`
      : '名称未命中目标模式关键词'

  if (confidence !== 'low') {
    return {
      selectedPlan: best.plan,
      score: best.score,
      confidence,
      matchedKeywords: best.matchedKeywords,
      usedSafeFallback: false,
      reason: bestReason,
    }
  }

  const active = plans.find((plan) => input.activeGuid && plan.guid.toLowerCase() === input.activeGuid.toLowerCase())
  const balanced = plans.find(
    (plan) => plan.guid.toLowerCase() === '381b4222-f694-41f0-9685-ff5bb260df2e' || normalizeText(plan.name).includes('平衡'),
  )
  const fallback = active ?? balanced ?? plans[0]

  return {
    selectedPlan: fallback,
    score: best.score,
    confidence: 'low',
    matchedKeywords: best.matchedKeywords,
    usedSafeFallback: true,
    reason: `低置信匹配，回退到更稳妥计划：${fallback.name}`,
    warning: `未找到高置信度匹配，已使用稳妥兜底（${fallback.name}）`,
  }
}
