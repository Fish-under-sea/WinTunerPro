import type {
  OemDetectResult,
  OemBrand,
  ChassisInfo,
  OemApplyResult,
  OemPerformanceMode,
  OemFallbackMatchDetail,
} from '@shared/types/oem'
import { OEM_BRAND_DISPLAY_NAMES, PERFORMANCE_MODE_BRANDS } from '@shared/types/oem'
import { runPowerShell, asArray } from './powershellRunner'
import { matchExistingPowerPlanForMode, setPowerPlan } from './powerService'
import { resolveFallbackModeFromOem } from '@shared/utils/powerPlanMatcher'

/**
 * oem 模块业务服务（产品核心分流：是否走品牌专属性能模式）。
 *
 * scripts/oem/Get-ChassisAndBrand.ps1 只采原始事实（厂商/系列/型号/机箱类型/电池/是否笔记本），
 * 品牌归一化与 supportsPerformanceMode 判定在此完成——复用 src/shared/types/oem.ts 的
 * OEM_BRAND_DISPLAY_NAMES / PERFORMANCE_MODE_BRANDS，避免在 PS/TS 两处重复维护品牌名单。
 *
 * 判定规则：笔记本 且 品牌 ∈ PERFORMANCE_MODE_BRANDS → supportsPerformanceMode=true；
 *          否则 false 并给出 fallbackNote 引导走电源设置兜底（见 power 模块）。
 */

/** 脚本返回的原始机箱/品牌信息（容错解析） */
interface RawChassisBrand {
  manufacturer?: unknown
  systemFamily?: unknown
  model?: unknown
  chassisTypeName?: unknown
  hasBattery?: unknown
  isLaptop?: unknown
}

interface RawOemApplyResult {
  success?: unknown
  brand?: unknown
  mode?: unknown
  appliedBrandMode?: unknown
  usedBrandMode?: unknown
  fallbackUsed?: unknown
  message?: unknown
  warnings?: unknown
  details?: unknown
}

function dedupeWarnings(warnings: string[]): string[] {
  const unique = Array.from(new Set(warnings.map((w) => String(w).trim()).filter(Boolean)))
  return unique.slice(0, 2)
}

/**
 * 品牌归一化：用厂商/系列/型号关键字映射到 OemBrand 枚举。
 * 关键字含各品牌整机与子品牌（如 Legion/ThinkPad、ROG/TUF、Alienware/XPS 等），
 * 兼顾英文与中文厂商串；命中已知厂商但不在名单内归 Other，厂商为空归 Unknown。
 */
function normalizeBrand(manufacturer: string, systemFamily: string, model: string): OemBrand {
  const hay = `${manufacturer} ${systemFamily} ${model}`.toLowerCase()

  if (/lenovo|legion|thinkpad|thinkbook|ideapad|yoga|联想/.test(hay)) return 'Lenovo'
  if (/asus|asustek|\brog\b|\btuf\b|zenbook|vivobook|华硕/.test(hay)) return 'Asus'
  if (/hewlett|\bhp\b|omen|victus|惠普/.test(hay)) return 'HP'
  if (/dell|alienware|inspiron|latitude|\bxps\b|precision|vostro|戴尔/.test(hay)) return 'Dell'
  if (/razer|雷蛇/.test(hay)) return 'Razer'
  if (/mechrevo|机械革命/.test(hay)) return 'MechRevo'
  if (/machenike|mechanike|机械师/.test(hay)) return 'Mechanike'
  if (/hasee|神舟/.test(hay)) return 'Hasee'
  if (/hojo|火影/.test(hay)) return 'Hojo'

  // 厂商串非空但未命中已知品牌 → Other；完全为空 → Unknown
  return manufacturer.trim() ? 'Other' : 'Unknown'
}

/** 检测机箱类型与 OEM 品牌，并判定是否支持品牌专属性能模式 */
export async function detectOem(): Promise<OemDetectResult> {
  const raw = await runPowerShell<RawChassisBrand>('oem/Get-ChassisAndBrand.ps1')

  const manufacturer = String(raw.manufacturer ?? '')
  const systemFamily = String(raw.systemFamily ?? '')
  const model = String(raw.model ?? '')
  const isLaptop = Boolean(raw.isLaptop)

  const brand = normalizeBrand(manufacturer, systemFamily, model)

  const chassis: ChassisInfo = {
    isLaptop,
    chassisType: String(raw.chassisTypeName ?? 'Unknown'),
    hasBattery: Boolean(raw.hasBattery),
  }

  // 核心分流：必须是笔记本 + 主流可调度品牌，才走品牌专属性能模式
  const supportsPerformanceMode = isLaptop && PERFORMANCE_MODE_BRANDS.includes(brand)

  let fallbackNote = ''
  if (!supportsPerformanceMode) {
    fallbackNote = isLaptop
      ? '该机型暂无品牌专属性能模式，已切换为系统电源方案调节。'
      : '当前为台式机/非笔记本设备，无品牌专属性能模式，已切换为系统电源方案调节。'
  }

  return {
    chassis,
    brand,
    brandDisplayName: OEM_BRAND_DISPLAY_NAMES[brand],
    supportsPerformanceMode,
    fallbackNote,
  }
}

const OEM_MODE_WHITELIST: readonly OemPerformanceMode[] = ['quiet', 'balanced', 'performance', 'beast']

/** 应用 OEM 性能模式（品牌调度失败时自动走电源兜底） */
export async function applyOemMode(mode: OemPerformanceMode): Promise<OemApplyResult> {
  if (!OEM_MODE_WHITELIST.includes(mode)) {
    throw new Error(`不支持的 OEM 性能模式：${mode}`)
  }

  const detect = await detectOem()
  const warnings: string[] = []
  const targetMode = resolveFallbackModeFromOem(mode)

  const applyPowerFallback = async (): Promise<OemFallbackMatchDetail> => {
    const match = await matchExistingPowerPlanForMode(targetMode)
    await setPowerPlan(match.selectedPlan.guid)
    if (match.warning) warnings.push(match.warning)
    return {
      targetMode,
      selectedPlanGuid: match.selectedPlan.guid,
      selectedPlanName: match.selectedPlan.name,
      score: match.score,
      confidence: match.confidence,
      matchedKeywords: match.matchedKeywords,
      reason: match.reason,
      warning: match.warning,
    }
  }

  if (!detect.supportsPerformanceMode) {
    const fallbackMatch = await applyPowerFallback()
    return {
      success: true,
      brand: detect.brand,
      mode,
      usedBrandMode: false,
      usedPowerFallback: true,
      fallbackPlanName: fallbackMatch.selectedPlanName,
      fallbackTargetMode: targetMode,
      fallbackMatch,
      message: detect.fallbackNote || '当前品牌不支持专属调度，已切换电源计划兜底',
      warnings: dedupeWarnings(warnings),
    }
  }

  const scriptResult = await runPowerShell<RawOemApplyResult>('oem/Set-OemPerformanceMode.ps1', [
    '-Brand',
    detect.brand,
    '-Mode',
    mode,
  ])

  warnings.push(...dedupeWarnings(asArray<string>(scriptResult.warnings).map((w) => String(w))))

  const appliedBrandMode =
    scriptResult.appliedBrandMode !== undefined
      ? Boolean(scriptResult.appliedBrandMode)
      : Boolean(scriptResult.usedBrandMode)
  const usedBrandMode = appliedBrandMode
  const fallbackUsedHint = Boolean(scriptResult.fallbackUsed)
  const details =
    scriptResult.details && typeof scriptResult.details === 'object'
      ? (scriptResult.details as Record<string, unknown>)
      : undefined

  if (usedBrandMode && Boolean(scriptResult.success)) {
    return {
      success: true,
      brand: detect.brand,
      mode,
      appliedBrandMode: true,
      usedBrandMode: true,
      fallbackUsed: false,
      usedPowerFallback: false,
      message: String(scriptResult.message ?? '品牌性能模式已应用'),
      warnings: dedupeWarnings(warnings),
      details,
    }
  }

  // 品牌脚本未命中/失败时，不新建电源计划，仅在现有计划中智能匹配兜底。
  const fallbackMatch = await applyPowerFallback()
  warnings.push('品牌专属接口不可用，已自动切换为电源计划兜底')

  return {
    success: true,
    brand: detect.brand,
    mode,
    appliedBrandMode: false,
    usedBrandMode: false,
    fallbackUsed: fallbackUsedHint || true,
    usedPowerFallback: true,
    fallbackPlanName: fallbackMatch.selectedPlanName,
    fallbackTargetMode: targetMode,
    fallbackMatch,
    message: String(scriptResult.message ?? '品牌专属调度未生效，已启用电源兜底'),
    warnings: dedupeWarnings(warnings),
    details,
  }
}
