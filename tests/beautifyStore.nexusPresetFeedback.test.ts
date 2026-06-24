import { beforeAll, describe, expect, it } from 'vitest'
import type { ElectronAPI, NexusConfigImportResult } from '@shared/types'

beforeAll(() => {
  // beautifyStore 在创建时会订阅 onInstallProgress，需先桩 window.electronAPI
  const api = {
    onInstallProgress: () => () => undefined,
  } as unknown as ElectronAPI
  ;(globalThis as { window?: { electronAPI: ElectronAPI } }).window = { electronAPI: api }
})

describe('getApplyNexusPresetFeedback', () => {
  it('预设源缺失（null）时返回 warning 并引导补放 wsbackup.wbk', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getApplyNexusPresetFeedback(null)
    expect(feedback.tone).toBe('warning')
    expect(feedback.title).toContain('未找到')
    expect(feedback.description).toContain('wsbackup.wbk')
    expect(feedback.dryRun).toBe(false)
  })

  it('DryRun 预演时返回 info，标注未写入并给出对齐/跳过项数', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const result: NexusConfigImportResult = {
      configImported: false,
      format: 'wbk',
      dryRun: true,
      plannedCount: 18,
      skippedShortcutCount: 5,
    }
    const feedback = mod.getApplyNexusPresetFeedback(result)
    expect(feedback.tone).toBe('info')
    expect(feedback.dryRun).toBe(true)
    expect(feedback.title).toContain('预演')
    expect(feedback.description).toContain('18 项')
    expect(feedback.description).toContain('5 项')
    expect(feedback.description).toContain('尚未写入注册表')
  })

  it('DryRun 时 plannedCount 缺省回退到 writtenCount 计数', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getApplyNexusPresetFeedback({
      configImported: false,
      dryRun: true,
      writtenCount: 7,
    })
    expect(feedback.tone).toBe('info')
    expect(feedback.description).toContain('7 项')
    // 缺省 skippedShortcutCount 按 0 计
    expect(feedback.description).toContain('0 项快捷方式')
  })

  it('真实写入成功（configImported 且非 DryRun）时返回 success 并给出写入项数', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getApplyNexusPresetFeedback({
      configImported: true,
      format: 'wbk',
      writtenCount: 20,
      skippedShortcutCount: 3,
    })
    expect(feedback.tone).toBe('success')
    expect(feedback.dryRun).toBe(false)
    expect(feedback.title).toContain('已应用')
    expect(feedback.description).toContain('已写入 20 项')
    expect(feedback.description).toContain('3 项')
  })

  it('既未导入也非预演时兜底为 warning，不静默成成功', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getApplyNexusPresetFeedback({ configImported: false })
    expect(feedback.tone).toBe('warning')
    expect(feedback.title).toContain('未生效')
    expect(feedback.dryRun).toBe(false)
  })

  it('存在 warnings 时追加到描述末尾（DryRun 形态）', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getApplyNexusPresetFeedback({
      configImported: false,
      dryRun: true,
      plannedCount: 10,
      skippedShortcutCount: 2,
      warnings: ['自动重启 Nexus 失败'],
    })
    expect(feedback.description).toContain('注意：自动重启 Nexus 失败')
  })
})
