/**
 * backup 模块共享类型——配置备份与迁移（真实落地）。
 *
 * 设计要点：
 *   - 备份统一落在 %AppData%\WinTunerPro\backups，主进程枚举该目录得到真实历史。
 *   - reg 快照：reg.exe export 导出应用会改动的用户级注册表键（可一键还原）。
 *   - .wtp 配置档案：把当前应用配置 + 注册表快照打包为单文件（AES-256-GCM 加密），
 *     便于跨机器复用；导入时解密后写回配置并可选导入注册表。
 */

/** 备份记录类型 */
export type BackupKind = 'reg-snapshot' | 'wtp'

/** 单条备份记录（`backup:list` 返回项） */
export interface BackupRecord {
  /** 唯一 id（取文件名，稳定可用于还原/删除定位） */
  id: string
  /** 展示名 */
  name: string
  /** 记录类型 */
  kind: BackupKind
  /** 创建时间（ISO 8601 字符串，前端格式化展示） */
  createdAt: string
  /** 文件大小（字节） */
  sizeBytes: number
  /** 绝对路径（仅主进程内部使用，前端不直接消费） */
  path: string
}

/** 创建注册表快照的结果（`backup:create-snapshot`） */
export interface CreateSnapshotResult {
  /** 是否成功 */
  success: boolean
  /** 新建记录 */
  record: BackupRecord | null
  /** 实际导出的注册表键 */
  exportedKeys: string[]
  /** 人话告警（如部分键不存在被跳过） */
  warnings: string[]
}

/** 还原备份的结果（`backup:restore`） */
export interface RestoreResult {
  /** 是否成功 */
  success: boolean
  /** 还原前自动创建的安全快照路径（便于回退） */
  safetyBackupPath?: string
  /** 人话提示 */
  message: string
  /** 告警（如编码兼容转码） */
  warnings: string[]
}

/** 导出 .wtp 的结果（`backup:export-wtp`） */
export interface ExportWtpResult {
  /** 用户是否取消了保存对话框 */
  canceled: boolean
  /** 导出文件路径（未取消时有值） */
  path?: string
  /** 新建记录（保存在 backups 目录内时有值） */
  record?: BackupRecord | null
}

/** 导入 .wtp 的结果（`backup:import-wtp`） */
export interface ImportWtpResult {
  /** 用户是否取消了选择对话框 */
  canceled: boolean
  /** 是否成功导入 */
  success: boolean
  /** 是否回写了应用配置 */
  configApplied: boolean
  /** 是否导入了注册表快照 */
  registryApplied: boolean
  /** 人话提示 */
  message: string
  /** 告警 */
  warnings: string[]
}
