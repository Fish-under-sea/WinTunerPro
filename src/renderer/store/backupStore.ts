import { create } from 'zustand'
import type { BackupRecord } from '@shared/types'
import { errorMessage } from '@renderer/lib/async'
import { toast } from './toastStore'

/**
 * 配置备份 store：枚举真实备份历史（listBackups），创建注册表快照、还原、删除，
 * 以及导出/导入 .wtp 档案（写操作）。所有系统写入经主进程 service + PowerShell。
 */
interface BackupStore {
  records: BackupRecord[]
  loading: boolean
  error: string | null
  loaded: boolean
  /** 进行中的写操作标识（'snapshot' / 'export' / 'import' / 记录 id），用于按钮 loading */
  busy: string | null
  load: (force?: boolean) => Promise<void>
  createSnapshot: () => Promise<void>
  restore: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  exportWtp: () => Promise<void>
  importWtp: () => Promise<void>
}

export const useBackupStore = create<BackupStore>((set, get) => ({
  records: [],
  loading: false,
  error: null,
  loaded: false,
  busy: null,
  load: async (force = false) => {
    const { loading, loaded } = get()
    if (loading) return
    if (loaded && !force) return
    set({ loading: true, error: null })
    try {
      const records = await window.electronAPI.listBackups()
      set({ records, loading: false, loaded: true })
    } catch (err) {
      set({ error: errorMessage(err), loading: false })
    }
  },
  createSnapshot: async () => {
    if (get().busy) return
    set({ busy: 'snapshot' })
    try {
      const result = await window.electronAPI.createBackupSnapshot()
      if (result.success) {
        toast.success('配置快照已创建', `已导出 ${result.exportedKeys.length} 个注册表键`)
      } else {
        toast.warning('未创建快照', '没有可导出的注册表键')
      }
      if (result.warnings.length > 0) {
        toast.warning('快照告警', result.warnings.join('；'))
      }
      await get().load(true)
    } catch (err) {
      toast.error('创建快照失败', errorMessage(err))
    } finally {
      set({ busy: null })
    }
  },
  restore: async (id) => {
    if (get().busy) return
    set({ busy: id })
    try {
      const result = await window.electronAPI.restoreBackup(id)
      if (result.success) {
        toast.success('还原完成', result.message)
      } else {
        toast.warning('还原未完成', result.message)
      }
      if (result.warnings.length > 0) {
        toast.warning('还原告警', result.warnings.join('；'))
      }
      await get().load(true)
    } catch (err) {
      toast.error('还原失败', errorMessage(err))
    } finally {
      set({ busy: null })
    }
  },
  remove: async (id) => {
    if (get().busy) return
    set({ busy: id })
    try {
      await window.electronAPI.deleteBackup(id)
      toast.success('已删除该备份')
      await get().load(true)
    } catch (err) {
      toast.error('删除失败', errorMessage(err))
    } finally {
      set({ busy: null })
    }
  },
  exportWtp: async () => {
    if (get().busy) return
    set({ busy: 'export' })
    try {
      const result = await window.electronAPI.exportWtp()
      if (result.canceled) return
      toast.success('配置档案已导出', result.path)
      await get().load(true)
    } catch (err) {
      toast.error('导出配置失败', errorMessage(err))
    } finally {
      set({ busy: null })
    }
  },
  importWtp: async () => {
    if (get().busy) return
    set({ busy: 'import' })
    try {
      const result = await window.electronAPI.importWtp()
      if (result.canceled) return
      if (result.success) {
        toast.success('配置档案已导入', result.message)
      } else {
        toast.warning('导入未生效', result.message)
      }
      if (result.warnings.length > 0) {
        toast.warning('导入告警', result.warnings.join('；'))
      }
      await get().load(true)
    } catch (err) {
      toast.error('导入配置失败', errorMessage(err))
    } finally {
      set({ busy: null })
    }
  },
}))
