import { beforeAll, describe, expect, it } from 'vitest'
import type { ElectronAPI } from '@shared/types'

beforeAll(() => {
  const api = {
    onInstallProgress: () => () => undefined,
  } as unknown as ElectronAPI
  ;(globalThis as { window?: { electronAPI: ElectronAPI } }).window = { electronAPI: api }
})

describe('getNexusInstallFeedback', () => {
  it('配置导入成功时返回成功提示', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getNexusInstallFeedback({
      installedBy: 'offline-exe',
      configImported: true,
      warnings: [],
    })
    expect(feedback).toEqual({ tone: 'success', title: 'Nexus 安装完成' })
  })

  it('配置导入失败时返回告警提示（避免误报安装失败）', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getNexusInstallFeedback({
      installedBy: 'offline-exe',
      configImported: false,
      warnings: [],
    })
    expect(feedback.tone).toBe('warning')
    expect(feedback.title).toContain('已安装')
  })
})
