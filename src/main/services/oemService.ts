import type { OemDetectResult, OemBrand, ChassisInfo } from '@shared/types/oem'
import { OEM_BRAND_DISPLAY_NAMES, PERFORMANCE_MODE_BRANDS } from '@shared/types/oem'
import { runPowerShell } from './powershellRunner'

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
