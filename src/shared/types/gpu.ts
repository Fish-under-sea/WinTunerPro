/**
 * gpu 模块共享类型——显卡检测（数据契约）。
 *
 * 对应 WMI 来源：Win32_VideoController（名称、AdapterRAM、DriverVersion、PNPDeviceID 判厂商）。
 * 核显判定可结合 PNPDeviceID / 名称关键字。检测结果用于后续 N 卡 / A 卡分流调优。
 */

/** 显卡厂商 */
export type GpuVendor = 'NVIDIA' | 'AMD' | 'Intel' | 'Unknown'

/** 单块显卡信息 */
export interface GpuInfo {
  /** 显卡名称，如 “NVIDIA GeForce RTX 4060 Laptop GPU” */
  name: string
  /** 厂商 */
  vendor: GpuVendor
  /** 显存大小（MB） */
  vramMB: number
  /** 驱动版本 */
  driverVersion: string
  /** 是否核显（集成显卡） */
  isIntegrated: boolean
}

/** 显卡检测结果（`gpu:detect` 返回结构） */
export interface GpuDetectResult {
  /** 检测到的全部显卡 */
  gpus: GpuInfo[]
  /** 主显卡厂商（用于决定走哪套竞技预设） */
  primaryVendor: GpuVendor
}

/** NVIDIA 基础预设档位（白名单） */
export type NvidiaPresetId = 'competitive' | 'balanced' | 'power-saving'

/** `gpu:apply-nvidia-preset` 返回结构 */
export interface GpuApplyResult {
  /** 是否执行成功（脚本层面） */
  success: boolean
  /** 当前检测到的主显卡厂商 */
  vendor: GpuVendor
  /** 本次请求的预设档位 */
  presetId: NvidiaPresetId
  /** 是否实际应用了 NVIDIA 相关设置 */
  applied: boolean
  /** 注册表备份路径（存在写操作时返回） */
  backupPath?: string
  /** 非致命告警，前端可直接展示 */
  warnings: string[]
  /** 人话结果说明 */
  message: string
}

/** 显卡调优选项 ID（支持批量执行） */
export type GpuTweakOptionId =
  | 'nvidia-low-latency'
  | 'enable-hags'
  | 'enable-game-mode'
  | 'power-plan-performance'
  | 'nvidia-profile'

/** NVIDIA 控制面板竞技预设当前状态（`gpu:get-nvidia-profile-status` 只读查询） */
export interface NvidiaProfileStatus {
  imageSettingsMode: number
  imageSettingsValue: number
  openGLGpu: string
  powerMizerLevel: number
  preferredRefreshRate: number
  targetImageMode: number
  targetImageValue: number
  targetPowerLevel: number
  targetRefreshRate: number
}

/** 单个调优选项定义 */
export interface GpuTweakOption {
  id: GpuTweakOptionId
  name: string
  description: string
  tradeoff: string
  available: boolean
  availabilityReason: string
}

/** 单个调优项执行结果 */
export interface GpuTweakExecutionResult {
  id: GpuTweakOptionId
  status: 'success' | 'failed' | 'skipped'
  reason: string
}

/** 批量调优执行结果 */
export interface GpuTweakApplyResult {
  success: boolean
  summary: string
  warnings: string[]
  results: GpuTweakExecutionResult[]
}

/** 根据主显卡厂商构建可执行调优项列表 */
export function buildGpuTweakCatalog(primaryVendor: GpuVendor): GpuTweakOption[] {
  const isNvidia = primaryVendor === 'NVIDIA'
  return [
    {
      id: 'nvidia-low-latency',
      name: 'NVIDIA 低延迟电源保持',
      description: '通过 nvidia-smi 开启持久模式，并写入 WinTuner 的低延迟预设标记。',
      tradeoff: '非 NVIDIA 设备不支持；部分驱动或权限不足时会自动跳过。',
      available: isNvidia,
      availabilityReason: isNvidia ? '已检测到 NVIDIA 主显卡，可执行。' : '仅 NVIDIA 主显卡可用。',
    },
    {
      id: 'enable-hags',
      name: '开启硬件加速 GPU 调度（HAGS）',
      description: '启用系统图形调度硬件加速，降低 CPU 调度开销。',
      tradeoff: '通常需要重启生效；少数驱动版本可能出现兼容性波动。',
      available: true,
      availabilityReason: '支持 Windows 10/11 的系统图形设置。',
    },
    {
      id: 'enable-game-mode',
      name: '开启 Windows 游戏模式',
      description: '减少后台抢占，优先保障前台游戏线程。',
      tradeoff: '对轻负载场景收益有限，策略由系统版本决定。',
      available: true,
      availabilityReason: '系统级功能，默认可执行。',
    },
    {
      id: 'power-plan-performance',
      name: '切换到性能向电源计划',
      description: '在现有计划中优先匹配卓越/高性能方案并切换。',
      tradeoff: '功耗与温度上升，续航降低。',
      available: true,
      availabilityReason: '基于本机已有电源计划执行，不新建计划。',
    },
    {
      id: 'nvidia-profile',
      name: 'NVIDIA 控制面板竞技预设',
      description:
        '写入图像设置（性能优先）、OpenGL 渲染 GPU（独立显卡）、电源管理模式（最高性能）、首选刷新率（最高可用）四项设置。\n' +
        '· 图像设置 → 使用我的优先选择（性能端）\n' +
        '· OpenGL 渲染 GPU → 独立显卡\n' +
        '· 电源管理模式 → 最高性能优先\n' +
        '· 首选刷新率 → 最高可用',
      tradeoff:
        '电源管理模式变更需驱动重启后完全生效；OpenGL GPU 绑定依赖独显 PNP ID，核显设备跳过该子项。',
      available: isNvidia,
      availabilityReason: isNvidia ? '已检测到 NVIDIA 主显卡，可执行。' : '仅 NVIDIA 主显卡支持。',
    },
  ]
}
