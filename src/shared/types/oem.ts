/**
 * oem 模块共享类型——机箱判定与品牌识别（数据契约）。
 *
 * 对应 WMI 来源：Win32_SystemEnclosure.ChassisTypes（判笔记本/台式）、Win32_Battery（判电池）、
 * Win32_ComputerSystem.Manufacturer（判品牌）。
 *
 * 设计意图：
 *   - 笔记本 且 主流 OEM（联想/华硕/惠普/戴尔/雷蛇/机械革命/机械师/神舟）→ supportsPerformanceMode=true，
 *     走对应品牌的最高性能模式调度。
 *   - 非笔记本，或非主流本（如火影 Hojo）→ supportsPerformanceMode=false，前端引导走电源设置兜底（见 power 模块）。
 */

/** 机箱信息 */
export interface ChassisInfo {
  /** 是否为笔记本 */
  isLaptop: boolean
  /** 机箱类型展示名（由 Win32_SystemEnclosure.ChassisTypes 数值映射而来，如 “Notebook” / “Desktop”） */
  chassisType: string
  /** 是否检测到电池（笔记本通常为 true） */
  hasBattery: boolean
}

/**
 * OEM 品牌英文枚举值（稳定标识，用于代码分流与脚本选择）。
 * 中文展示名分离到 OEM_BRAND_DISPLAY_NAMES，避免把展示文案散落在逻辑里。
 */
export type OemBrand =
  | 'Lenovo'
  | 'Asus'
  | 'HP'
  | 'Dell'
  | 'Razer'
  | 'MechRevo'
  | 'Mechanike'
  | 'Hasee'
  | 'Hojo'
  | 'Other'
  | 'Unknown'

/** OEM 品牌 → 中文展示名映射（展示与逻辑分离） */
export const OEM_BRAND_DISPLAY_NAMES: Record<OemBrand, string> = {
  Lenovo: '联想',
  Asus: '华硕',
  HP: '惠普',
  Dell: '戴尔',
  Razer: '雷蛇',
  MechRevo: '机械革命',
  Mechanike: '机械师',
  Hasee: '神舟',
  Hojo: '火影',
  Other: '其他品牌',
  Unknown: '未知品牌',
}

/**
 * 主流可调度品牌集合（具备专属性能模式调度能力）。
 * 不在此集合的品牌（含火影 Hojo / Other / Unknown）一律走电源设置兜底。
 */
export const PERFORMANCE_MODE_BRANDS: readonly OemBrand[] = [
  'Lenovo',
  'Asus',
  'HP',
  'Dell',
  'Razer',
  'MechRevo',
  'Mechanike',
  'Hasee',
]

/** OEM 检测结果（`oem:detect` 返回结构） */
export interface OemDetectResult {
  /** 机箱信息 */
  chassis: ChassisInfo
  /** 识别出的品牌（英文枚举值） */
  brand: OemBrand
  /** 品牌中文展示名 */
  brandDisplayName: string
  /** 是否为「笔记本 + 主流 OEM」，可走专属性能模式调度 */
  supportsPerformanceMode: boolean
  /** 兜底说明：当 supportsPerformanceMode=false 时，向用户解释为何走电源设置兜底 */
  fallbackNote: string
}
