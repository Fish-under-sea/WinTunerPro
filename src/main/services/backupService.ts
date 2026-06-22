import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import type {
  BackupKind,
  BackupRecord,
  CreateSnapshotResult,
  ExportWtpResult,
  ImportWtpResult,
  RestoreResult,
} from '@shared/types/backup'
import { runPowerShell } from './powershellRunner'

/**
 * backup 模块业务服务（真实实现）。
 *
 * 设计要点（见 code-organization.mdc）：
 *   - 备份目录 %AppData%\WinTunerPro\backups 是「真实历史」的唯一来源，list 即枚举该目录。
 *   - 注册表导出/导入（写系统）走 scripts/backup/ 下 PowerShell，主进程仅做参数白名单与调度。
 *   - .wtp 档案为单文件容器（AES-256-GCM 加密，密钥随应用内置，仅作落盘混淆/防误读，
 *     非对抗强攻击），内含应用 config.json 与一份注册表快照文本。
 *   - 还原/删除/导入仅允许作用于 backups 目录内或用户显式选择的 .wtp，防越权。
 */

/** .wtp 文件魔数（4 字节），用于快速识别容器格式 */
const WTP_MAGIC = Buffer.from('WTP1', 'ascii')

/** AES-256-GCM 内置密钥（由固定串派生；属落盘混淆级别，非用户私钥） */
const WTP_KEY = createHash('sha256').update('WinTunerPro::wtp::v1').digest()

/** .wtp 解密后的归档结构 */
interface WtpArchive {
  magic: 'WTP'
  version: number
  createdAt: string
  app: string
  appVersion: string
  /** 应用配置（config.json 内容） */
  config: Record<string, unknown>
  /** 注册表快照文本（.reg 内容，UTF-16 源转存为 UTF-8 文本保存），可空 */
  registry?: string
}

function getWtDir(): string {
  return join(app.getPath('appData'), 'WinTunerPro')
}

function getBackupDir(): string {
  return join(getWtDir(), 'backups')
}

function getConfigFile(): string {
  return join(getWtDir(), 'config.json')
}

function ensureBackupDir(): string {
  const dir = getBackupDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function readConfig(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(getConfigFile(), 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeConfig(next: Record<string, unknown>): void {
  mkdirSync(dirname(getConfigFile()), { recursive: true })
  writeFileSync(getConfigFile(), JSON.stringify(next, null, 2), 'utf-8')
}

/** 由文件名 + 扩展名推断展示名与类型 */
function describeBackupFile(fileName: string): { name: string; kind: BackupKind } {
  const ext = extname(fileName).toLowerCase()
  if (ext === '.wtp') {
    return { name: fileName.replace(/\.wtp$/i, ''), kind: 'wtp' }
  }
  // .reg：按已知前缀给出更友好的名称
  const base = fileName.replace(/\.reg$/i, '')
  let name = base
  if (/^regsnapshot-/i.test(base)) name = '配置快照'
  else if (/^nexus-/i.test(base)) name = 'Nexus 配置备份'
  else if (/^translucenttb/i.test(base)) name = 'TranslucentTB 配置备份'
  else if (/Explorer_Advanced/i.test(base)) name = '资源管理器设置备份'
  else if (/Desktop/i.test(base)) name = '桌面/壁纸设置备份'
  return { name, kind: 'reg-snapshot' }
}

/** 把 backups 目录内的某个 id 解析为受白名单约束的真实文件路径 */
function resolveBackupPath(id: string): string {
  if (typeof id !== 'string' || !id || id.includes('/') || id.includes('\\') || id.includes('..')) {
    throw new Error('非法的备份标识，已拒绝')
  }
  const dir = resolve(getBackupDir())
  const target = resolve(join(dir, id))
  if (!target.toLowerCase().startsWith(dir.toLowerCase() + '\\')) {
    throw new Error('备份路径越权，已拒绝')
  }
  if (!existsSync(target)) {
    throw new Error('备份文件不存在')
  }
  return target
}

function fileToRecord(filePath: string): BackupRecord {
  const fileName = basename(filePath)
  const st = statSync(filePath)
  const { name, kind } = describeBackupFile(fileName)
  return {
    id: fileName,
    name,
    kind,
    createdAt: st.mtime.toISOString(),
    sizeBytes: st.size,
    path: filePath,
  }
}

/** 列出真实备份历史（按创建时间倒序） */
export async function listBackups(): Promise<BackupRecord[]> {
  const dir = getBackupDir()
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir).filter((f) => {
    const ext = extname(f).toLowerCase()
    return ext === '.reg' || ext === '.wtp'
  })
  const records = entries
    .map((f) => {
      try {
        return fileToRecord(join(dir, f))
      } catch {
        return null
      }
    })
    .filter((r): r is BackupRecord => r !== null)
  records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return records
}

interface RawSnapshot {
  file?: unknown
  sizeBytes?: unknown
  name?: unknown
  exportedKeys?: unknown
  warnings?: unknown
}

/** 创建注册表快照（导出应用相关用户级注册表键到 .reg） */
export async function createSnapshot(name?: string): Promise<CreateSnapshotResult> {
  ensureBackupDir()
  const label = (name ?? '').trim() || '手动配置快照'
  const raw = await runPowerShell<RawSnapshot>(
    'backup/New-RegistrySnapshot.ps1',
    ['-BackupDir', getBackupDir(), '-Name', label],
    60_000,
  )
  const file = String(raw.file ?? '')
  const exportedKeys = Array.isArray(raw.exportedKeys) ? raw.exportedKeys.map((k) => String(k)) : []
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.map((w) => String(w)) : []
  const record = file && existsSync(file) ? fileToRecord(file) : null
  if (record) record.name = label
  return { success: Boolean(record), record, exportedKeys, warnings }
}

interface RawRestore {
  success?: unknown
  safetyBackupPath?: unknown
  message?: unknown
  warnings?: unknown
}

/** 通过脚本导入一个 .reg 文件（写系统，前置安全快照） */
async function restoreRegFile(filePath: string): Promise<RestoreResult> {
  ensureBackupDir()
  const raw = await runPowerShell<RawRestore>(
    'backup/Restore-RegistrySnapshot.ps1',
    ['-File', filePath, '-BackupDir', getBackupDir()],
    60_000,
  )
  return {
    success: Boolean(raw.success),
    safetyBackupPath: String(raw.safetyBackupPath ?? '') || undefined,
    message: String(raw.message ?? '还原完成'),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map((w) => String(w)) : [],
  }
}

/** 还原指定备份（.reg 走脚本导入；.wtp 走解包应用） */
export async function restoreBackup(id: string): Promise<RestoreResult> {
  const target = resolveBackupPath(id)
  const ext = extname(target).toLowerCase()
  if (ext === '.reg') {
    return restoreRegFile(target)
  }
  if (ext === '.wtp') {
    const res = await applyWtpFile(target)
    return {
      success: res.success,
      message: res.message,
      warnings: res.warnings,
    }
  }
  throw new Error('不支持还原的备份类型')
}

/** 删除指定备份（仅限 backups 目录内自有文件） */
export async function deleteBackup(id: string): Promise<{ success: boolean }> {
  const target = resolveBackupPath(id)
  unlinkSync(target)
  return { success: true }
}

/** 把内存归档加密为 .wtp 字节流 */
function encryptArchive(archive: WtpArchive): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', WTP_KEY, iv)
  const plain = Buffer.from(JSON.stringify(archive), 'utf-8')
  const enc = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([WTP_MAGIC, iv, tag, enc])
}

/** 解密 .wtp 字节流为内存归档 */
function decryptArchive(buf: Buffer): WtpArchive {
  if (buf.length < WTP_MAGIC.length + 12 + 16 || !buf.subarray(0, 4).equals(WTP_MAGIC)) {
    throw new Error('不是有效的 .wtp 档案（魔数校验失败）')
  }
  const iv = buf.subarray(4, 16)
  const tag = buf.subarray(16, 32)
  const enc = buf.subarray(32)
  const decipher = createDecipheriv('aes-256-gcm', WTP_KEY, iv)
  decipher.setAuthTag(tag)
  try {
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return JSON.parse(dec.toString('utf-8')) as WtpArchive
  } catch {
    throw new Error('.wtp 档案解密失败（文件可能损坏或来自不兼容版本）')
  }
}

/** 读取一个 .reg 文件文本（UTF-16/UTF-8 自适应），用于打包进 .wtp */
function readRegText(filePath: string): string {
  const buf = readFileSync(filePath)
  // reg export 默认 UTF-16 LE（带 BOM）；据 BOM 选择解码
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le')
  }
  return buf.toString('utf-8')
}

async function getActiveWindow(): Promise<BrowserWindow | null> {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

/** 导出当前配置为 .wtp 档案（含一份即时注册表快照） */
export async function exportWtp(): Promise<ExportWtpResult> {
  ensureBackupDir()

  // 即时生成一份注册表快照文本并打包（不长期占用 backups 目录的额外 .reg）
  let registryText: string | undefined
  try {
    const snap = await runPowerShell<RawSnapshot>(
      'backup/New-RegistrySnapshot.ps1',
      ['-BackupDir', getBackupDir(), '-Name', 'wtp-临时快照'],
      60_000,
    )
    const snapFile = String(snap.file ?? '')
    if (snapFile && existsSync(snapFile)) {
      registryText = readRegText(snapFile)
      // 临时快照已并入 .wtp，删除独立 .reg 以免备份历史冗余
      unlinkSync(snapFile)
    }
  } catch {
    // 注册表快照失败不阻断导出，仅导出配置部分
    registryText = undefined
  }

  const archive: WtpArchive = {
    magic: 'WTP',
    version: 1,
    createdAt: new Date().toISOString(),
    app: 'WinTunerPro',
    appVersion: app.getVersion(),
    config: readConfig(),
  }
  if (registryText) archive.registry = registryText

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const defaultPath = join(getBackupDir(), `WinTunerProfile-${stamp}.wtp`)

  const win = await getActiveWindow()
  const result = win
    ? await dialog.showSaveDialog(win, {
        title: '导出配置档案',
        defaultPath,
        filters: [{ name: 'WinTuner 配置档案', extensions: ['wtp'] }],
      })
    : await dialog.showSaveDialog({
        title: '导出配置档案',
        defaultPath,
        filters: [{ name: 'WinTuner 配置档案', extensions: ['wtp'] }],
      })

  if (result.canceled || !result.filePath) {
    return { canceled: true }
  }

  writeFileSync(result.filePath, encryptArchive(archive))

  // 若用户保存到了 backups 目录内，回传记录以便前端即时刷新历史
  const savedInBackups = resolve(result.filePath)
    .toLowerCase()
    .startsWith(resolve(getBackupDir()).toLowerCase() + '\\')
  return {
    canceled: false,
    path: result.filePath,
    record: savedInBackups ? fileToRecord(result.filePath) : null,
  }
}

/** 应用一个 .wtp 文件：回写配置 + 可选导入注册表 */
async function applyWtpFile(filePath: string): Promise<ImportWtpResult> {
  const buf = readFileSync(filePath)
  const archive = decryptArchive(buf)
  const warnings: string[] = []

  let configApplied = false
  if (archive.config && typeof archive.config === 'object') {
    const merged = { ...readConfig(), ...archive.config }
    writeConfig(merged)
    configApplied = true
  }

  let registryApplied = false
  if (archive.registry && archive.registry.trim()) {
    ensureBackupDir()
    const tmpReg = join(getBackupDir(), `wtp-import-${Date.now()}.reg`)
    try {
      // reg import 需 UTF-16 LE；统一以 Unicode 落盘后交还原脚本（含安全快照 + 兼容转码）
      writeFileSync(tmpReg, Buffer.from('\ufeff' + archive.registry, 'utf16le'))
      const res = await restoreRegFile(tmpReg)
      registryApplied = res.success
      warnings.push(...res.warnings)
    } catch (err) {
      warnings.push(`注册表导入失败：${(err as Error).message}`)
    } finally {
      if (existsSync(tmpReg)) unlinkSync(tmpReg)
    }
  }

  const message = configApplied
    ? '配置档案已导入并应用，部分设置可能需重启资源管理器后生效。'
    : '配置档案已读取，但未包含可应用的配置。'
  return {
    canceled: false,
    success: configApplied || registryApplied,
    configApplied,
    registryApplied,
    message,
    warnings,
  }
}

/** 导入 .wtp 档案（弹选择对话框） */
export async function importWtp(): Promise<ImportWtpResult> {
  const win = await getActiveWindow()
  const opts = {
    title: '导入配置档案',
    properties: ['openFile' as const],
    filters: [{ name: 'WinTuner 配置档案', extensions: ['wtp'] }],
  }
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)

  if (result.canceled || result.filePaths.length === 0) {
    return {
      canceled: true,
      success: false,
      configApplied: false,
      registryApplied: false,
      message: '已取消导入',
      warnings: [],
    }
  }

  return applyWtpFile(result.filePaths[0])
}
