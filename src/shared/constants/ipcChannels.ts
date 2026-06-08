/**
 * IPC 通道名集中定义。
 *
 * 约定：通道名一律使用 `模块:动作` 格式（如 `gpu:detect`、`oem:apply-mode`），
 * 严禁在调用处书写裸字符串。三端（main / preload / renderer）统一从此处引用，
 * 保证主进程注册的 handler 与渲染进程的调用名一一对应。
 *
 * 扩展方式：新增模块时在此追加一组常量（如 GPU_CHANNELS），
 * 并在 `src/main/ipc/` 下新增对应处理器、在 preload 暴露对应白名单方法。
 */

/** 应用级通道（示例 + 通用能力） */
export const APP_CHANNELS = {
  /** 获取应用版本号 */
  GET_VERSION: 'app:get-version',
} as const

/** hardware 模块通道——设备与系统信息（只读） */
export const HARDWARE_CHANNELS = {
  /** 获取操作系统信息 */
  GET_SYSTEM_INFO: 'hardware:get-system-info',
  /** 获取设备硬件信息 */
  GET_DEVICE_INFO: 'hardware:get-device-info',
} as const

/** gpu 模块通道——显卡检测（只读） */
export const GPU_CHANNELS = {
  /** 检测显卡 */
  DETECT: 'gpu:detect',
  /** 列出可调节项 */
  LIST_TWEAK_OPTIONS: 'gpu:list-tweak-options',
  /** 批量执行调节项 */
  APPLY_TWEAKS: 'gpu:apply-tweaks',
  /** 应用 NVIDIA 预设 */
  APPLY_NVIDIA_PRESET: 'gpu:apply-nvidia-preset',
} as const

/** oem 模块通道——机箱判定与品牌识别（只读） */
export const OEM_CHANNELS = {
  /** 检测机箱类型与 OEM 品牌 */
  DETECT: 'oem:detect',
  /** 应用 OEM 性能模式 */
  APPLY_MODE: 'oem:apply-mode',
} as const

/** optimization 模块通道——系统优化白名单执行 */
export const OPTIMIZATION_CHANNELS = {
  /** 体检优化项（只读扫描） */
  SCAN: 'optimization:scan',
  /** 按白名单执行优化项 */
  APPLY: 'optimization:apply',
} as const

/** power 模块通道——电源计划 */
export const POWER_CHANNELS = {
  /** 读取电源计划列表与可改性 */
  GET_STATE: 'power:get-state',
  /** 切换激活电源计划（写操作） */
  SET_PLAN: 'power:set-plan',
} as const

/** reinstall 模块通道——系统重装/镜像来源/机器码 */
export const REINSTALL_CHANNELS = {
  /** 列出可用系统镜像来源 */
  LIST_SOURCES: 'reinstall:list-sources',
  /** 导入并校验自定义 ISO（写操作） */
  IMPORT_ISO: 'reinstall:import-iso',
  /** 读取机器码（只读展示） */
  GET_MACHINE_ID: 'reinstall:get-machine-id',
  /** 触发系统部署（invoke；本期为演示流水线，不做真实落地） */
  DEPLOY: 'reinstall:deploy',
  /** 部署进度事件（main→renderer 单向推送） */
  DEPLOY_PROGRESS: 'reinstall:deploy-progress',
} as const

/** beautify 模块通道——TranslucentTB / Nexus / 风格包 */
export const BEAUTIFY_CHANNELS = {
  /** 读取美化工具与风格包状态 */
  GET_STATUS: 'beautify:get-status',
  /** 安装 TranslucentTB（写操作） */
  INSTALL_TRANSLUCENTTB: 'beautify:install-translucenttb',
  /** 安装 Nexus（写操作） */
  INSTALL_NEXUS: 'beautify:install-nexus',
  /** 应用风格包（写操作） */
  APPLY_THEME: 'beautify:apply-theme',
  /** 安装进度事件（main→renderer 单向推送） */
  INSTALL_PROGRESS: 'beautify:install-progress',
} as const

/** wallpaper 模块通道——静态壁纸 + Wallpaper Engine 动态 */
export const WALLPAPER_CHANNELS = {
  /** 列出可用壁纸与当前壁纸 */
  LIST: 'wallpaper:list',
  /** 应用静态壁纸（写操作） */
  APPLY_STATIC: 'wallpaper:apply-static',
  /** 检测 Wallpaper Engine 安装状态 */
  DETECT_ENGINE: 'wallpaper:detect-engine',
  /** 引导安装 Wallpaper Engine（写操作） */
  GUIDE_INSTALL_ENGINE: 'wallpaper:guide-install-engine',
} as const

/**
 * main→renderer 单向推送（事件）通道名，不参与 invoke 的 handler 注册约束，
 * 因此从下方的 IpcChannel 联合类型中排除。
 */
export type IpcEventChannel =
  | typeof BEAUTIFY_CHANNELS.INSTALL_PROGRESS
  | typeof REINSTALL_CHANNELS.DEPLOY_PROGRESS

/**
 * 所有 invoke 通道名的联合类型，便于在主进程统一约束 handler 注册。
 * 后续新增模块常量后，在此并入即可获得类型收敛。
 * 注意：单向推送的事件通道（见 IpcEventChannel）不计入此联合。
 */
export type IpcChannel = Exclude<
  | (typeof APP_CHANNELS)[keyof typeof APP_CHANNELS]
  | (typeof HARDWARE_CHANNELS)[keyof typeof HARDWARE_CHANNELS]
  | (typeof GPU_CHANNELS)[keyof typeof GPU_CHANNELS]
  | (typeof OEM_CHANNELS)[keyof typeof OEM_CHANNELS]
  | (typeof OPTIMIZATION_CHANNELS)[keyof typeof OPTIMIZATION_CHANNELS]
  | (typeof POWER_CHANNELS)[keyof typeof POWER_CHANNELS]
  | (typeof REINSTALL_CHANNELS)[keyof typeof REINSTALL_CHANNELS]
  | (typeof BEAUTIFY_CHANNELS)[keyof typeof BEAUTIFY_CHANNELS]
  | (typeof WALLPAPER_CHANNELS)[keyof typeof WALLPAPER_CHANNELS],
  IpcEventChannel
>
