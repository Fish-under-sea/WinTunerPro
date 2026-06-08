import type { PowerState, PowerPlan } from '@shared/types/power'
import { runPowerShell, asArray, isGuid } from './powershellRunner'
import {
  matchPowerPlanForMode,
  sanitizePowerPlanDisplayName,
  type MatchPowerPlanResult,
  type OemFallbackTargetMode,
} from '@shared/utils/powerPlanMatcher'

/**
 * power 模块业务服务。
 *
 * - getPowerState：scripts/system/Get-PowerState.ps1 解析 powercfg /list 与 /getactivescheme，
 *   返回全部计划与 canModify（非主流机型「读取电源设置确保可改」的核心诉求）。
 * - setPowerPlan：低风险写操作。脚本切换前先记录当前活动方案 GUID（回滚依据）再 /setactive；
 *   主进程此处对传入 guid 做白名单校验（仅 GUID 形态）以防命令注入。
 */

/** 脚本返回的单个电源计划原始结构（容错解析） */
interface RawPowerPlan {
  guid?: unknown
  name?: unknown
  isActive?: unknown
}

/** 脚本返回的电源状态原始结构（容错解析） */
interface RawPowerState {
  plans?: unknown
  activeGuid?: unknown
  canModify?: unknown
}

interface EnsurePerformancePlanResult {
  guid: string
  name: string
}

/** 读取电源计划列表与可改性 */
export async function getPowerState(): Promise<PowerState> {
  const raw = await runPowerShell<RawPowerState>('system/Get-PowerState.ps1')
  const plans: PowerPlan[] = asArray<RawPowerPlan>(raw.plans).map((p) => ({
    guid: String(p?.guid ?? ''),
    name: String(p?.name ?? ''),
    isActive: Boolean(p?.isActive),
  })).map(sanitizePowerPlanDisplayName)
  return {
    plans,
    activeGuid: String(raw.activeGuid ?? ''),
    canModify: Boolean(raw.canModify),
  }
}

/** 切换激活电源计划（写操作，先白名单校验 guid 再交脚本执行，脚本内置回滚记录与结果校验） */
export async function setPowerPlan(guid: string): Promise<void> {
  if (!isGuid(guid)) {
    throw new Error('非法的电源方案 GUID，已拒绝执行')
  }
  await runPowerShell('system/Set-PowerPlan.ps1', ['-Guid', guid])
}

/**
 * 确保并切换到性能电源计划。
 * 先尽量复用当前系统已有计划，不存在时由脚本按白名单创建（卓越性能）。
 */
export async function ensurePerformancePlan(
  level: 'high' | 'ultimate' = 'ultimate',
): Promise<EnsurePerformancePlanResult> {
  const state = await getPowerState()
  const plans = state.plans

  const byGuid = (guid: string): PowerPlan | undefined =>
    plans.find((p) => p.guid.toLowerCase() === guid.toLowerCase())

  const byName = (keywords: string[]): PowerPlan | undefined =>
    plans.find((p) => {
      const name = p.name.toLowerCase()
      return keywords.some((kw) => name.includes(kw))
    })

  const highPerfGuid = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
  const ultimateBaseGuid = 'e9a42b02-d5df-448d-aa00-03f14749eb61'

  let target =
    level === 'ultimate'
      ? byName(['卓越性能', 'ultimate performance']) ??
        byGuid(ultimateBaseGuid) ??
        byName(['高性能', 'high performance']) ??
        byGuid(highPerfGuid)
      : byName(['高性能', 'high performance']) ?? byGuid(highPerfGuid)

  if (!target && level === 'ultimate') {
    const created = await runPowerShell<EnsurePerformancePlanResult>(
      'system/Ensure-PerformancePlan.ps1',
      ['-Level', 'ultimate'],
    )
    await setPowerPlan(created.guid)
    return created
  }

  if (!target) {
    throw new Error('未找到可用的性能电源计划，请先在系统中启用高性能方案')
  }

  await setPowerPlan(target.guid)
  return { guid: target.guid, name: target.name }
}

export async function matchExistingPowerPlanForMode(
  targetMode: OemFallbackTargetMode,
): Promise<MatchPowerPlanResult> {
  const state = await getPowerState()
  return matchPowerPlanForMode({
    targetMode,
    plans: state.plans,
    activeGuid: state.activeGuid,
  })
}
