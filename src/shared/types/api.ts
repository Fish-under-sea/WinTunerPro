import type { AppInfo } from './app'
import type { SystemInfo, DeviceInfo } from './hardware'
import type { GpuDetectResult } from './gpu'
import type {
  GpuApplyResult,
  GpuTweakApplyResult,
  GpuTweakOption,
  GpuTweakOptionId,
  NvidiaPresetId,
} from './gpu'
import type { OemDetectResult, OemApplyResult, OemPerformanceMode } from './oem'
import type { PowerState } from './power'
import type {
  SystemImageSource,
  IsoValidationResult,
  MachineIdInfo,
  ReinstallProgress,
  ChangeMachineIdOptions,
  ChangeMachineIdResult,
} from './reinstall'
import type { BeautifyStatus, InstallProgress, NexusInstallResult } from './beautify'
import type { WallpaperState, WallpaperEngineStatus } from './wallpaper'
import type {
  OptimizationApplyResult,
  OptimizationItemId,
  OptimizationScanResult,
} from './optimization'
import type {
  BackupRecord,
  CreateSnapshotResult,
  ExportWtpResult,
  ImportWtpResult,
  RestoreResult,
} from './backup'

/**
 * preload 通过 contextBridge 暴露给渲染进程的白名单 API 契约。
 *
 * 这是渲染进程能调用的全部能力的「唯一真相源」：
 *   - preload 负责实现本接口（`const api: ElectronAPI = {...}`）
 *   - 渲染进程通过 `window.electronAPI`（类型见 src/preload/index.d.ts）调用
 *
 * 扩展方式：新增能力时在此追加方法签名，preload 同步实现并经 ipcRenderer.invoke
 * 转发到对应的主进程 handler（通道名取自 src/shared/constants/ipcChannels.ts）。
 *
 * 现状：各模块均经主进程 service + PowerShell 真实落地（hardware/gpu/oem/power/optimization/
 * beautify/wallpaper/backup 与 reinstall 的镜像探测/机器码/ISO 校验）。仅 reinstall 的
 * 真实无人值守部署（startReinstallDeploy）出于安全考虑保留为演示流程，见 reinstallService。
 */
export interface ElectronAPI {
  /** 获取应用基础信息（版本、平台等） */
  getAppVersion: () => Promise<AppInfo>

  // ===== hardware：设备/系统信息（只读） =====
  /** 获取操作系统信息 */
  getSystemInfo: () => Promise<SystemInfo>
  /** 获取设备硬件信息 */
  getDeviceInfo: () => Promise<DeviceInfo>

  // ===== gpu：显卡（只读） =====
  /** 检测显卡 */
  detectGpu: () => Promise<GpuDetectResult>
  /** 列出显卡调优可选项（含支持状态） */
  listGpuTweakOptions: () => Promise<GpuTweakOption[]>
  /** 批量应用显卡调优项（写操作） */
  applyGpuTweaks: (optionIds: GpuTweakOptionId[]) => Promise<GpuTweakApplyResult>
  /** 应用 NVIDIA 基础预设（写操作） */
  applyNvidiaPreset: (presetId: NvidiaPresetId) => Promise<GpuApplyResult>

  // ===== oem：机箱判定 + 品牌识别（只读） =====
  /** 检测机箱类型与 OEM 品牌 */
  detectOem: () => Promise<OemDetectResult>
  /** 应用 OEM 性能模式（写操作，失败时自动走电源兜底） */
  applyOemMode: (mode: OemPerformanceMode) => Promise<OemApplyResult>

  // ===== power：电源计划 =====
  /** 读取电源计划列表与可改性 */
  getPowerState: () => Promise<PowerState>
  /** 切换激活电源计划（写操作） */
  setPowerPlan: (guid: string) => Promise<void>

  // ===== reinstall：系统重装/镜像来源/机器码 =====
  /** 列出可用系统镜像来源 */
  listSystemImageSources: () => Promise<SystemImageSource[]>
  /** 导入并校验自定义 ISO（写操作） */
  importIso: (path: string) => Promise<IsoValidationResult>
  /** 读取机器码（只读展示） */
  getMachineId: () => Promise<MachineIdInfo>
  /** 更改机器码（写操作：重新生成 MachineGuid，写前自动备份，可回滚） */
  changeMachineId: (options?: ChangeMachineIdOptions) => Promise<ChangeMachineIdResult>
  /** 触发系统部署（本期为演示流水线，不做真实落地）；进度经 onReinstallProgress 推送 */
  startReinstallDeploy: (sourceId: string) => Promise<void>
  /** 订阅部署进度事件，返回取消订阅函数 */
  onReinstallProgress: (cb: (p: ReinstallProgress) => void) => () => void

  // ===== beautify：TranslucentTB / Nexus / 风格包 =====
  /** 读取美化工具与风格包状态 */
  getBeautifyStatus: () => Promise<BeautifyStatus>
  /** 安装 TranslucentTB（写操作） */
  installTranslucentTB: () => Promise<void>
  /** 安装 Nexus（写操作） */
  installNexus: () => Promise<NexusInstallResult>
  /** 应用风格包（写操作） */
  applyTheme: (themeId: string) => Promise<void>
  /** 订阅安装进度事件（TranslucentTB / Nexus），返回取消订阅函数 */
  onInstallProgress: (cb: (p: InstallProgress) => void) => () => void

  // ===== wallpaper：静态壁纸 + Wallpaper Engine 动态 =====
  /** 列出可用壁纸与当前壁纸 */
  listWallpapers: () => Promise<WallpaperState>
  /** 应用静态壁纸（写操作） */
  applyStaticWallpaper: (id: string) => Promise<void>
  /** 检测 Wallpaper Engine 安装状态 */
  detectWallpaperEngine: () => Promise<WallpaperEngineStatus>
  /** 引导安装 Wallpaper Engine（写操作） */
  guideInstallWallpaperEngine: () => Promise<void>

  // ===== optimization：系统优化体检 + 执行 =====
  /** 体检优化项（只读，不修改系统） */
  scanOptimizations: (itemIds: OptimizationItemId[]) => Promise<OptimizationScanResult>
  /** 执行优化项（写操作，按 itemId 白名单） */
  applyOptimizations: (itemIds: OptimizationItemId[]) => Promise<OptimizationApplyResult>

  // ===== backup：配置备份与迁移 =====
  /** 列出真实备份历史（只读，枚举 backups 目录） */
  listBackups: () => Promise<BackupRecord[]>
  /** 创建注册表配置快照（写操作） */
  createBackupSnapshot: (name?: string) => Promise<CreateSnapshotResult>
  /** 还原指定备份（写操作，前置安全快照） */
  restoreBackup: (id: string) => Promise<RestoreResult>
  /** 删除指定备份记录（仅限 backups 目录内自有文件） */
  deleteBackup: (id: string) => Promise<{ success: boolean }>
  /** 导出当前配置为 .wtp 档案（写操作，弹保存对话框） */
  exportWtp: () => Promise<ExportWtpResult>
  /** 导入 .wtp 档案（写操作，弹选择对话框） */
  importWtp: () => Promise<ImportWtpResult>
}
