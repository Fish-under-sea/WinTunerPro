import type { PowerState, PowerPlan } from '@shared/types/power'
import { runPowerShell, asArray, isGuid } from './powershellRunner'

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

/** 读取电源计划列表与可改性 */
export async function getPowerState(): Promise<PowerState> {
  const raw = await runPowerShell<RawPowerState>('system/Get-PowerState.ps1')
  const plans: PowerPlan[] = asArray<RawPowerPlan>(raw.plans).map((p) => ({
    guid: String(p?.guid ?? ''),
    name: String(p?.name ?? ''),
    isActive: Boolean(p?.isActive),
  }))
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
