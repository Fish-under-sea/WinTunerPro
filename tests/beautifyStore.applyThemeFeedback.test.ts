import { beforeAll, describe, expect, it } from 'vitest'
import type { ApplyThemeResult, ElectronAPI, ThemeStepResult } from '@shared/types'

beforeAll(() => {
  // beautifyStore 在创建时会订阅 onInstallProgress，需先桩 window.electronAPI
  const api = {
    onInstallProgress: () => () => undefined,
  } as unknown as ElectronAPI
  ;(globalThis as { window?: { electronAPI: ElectronAPI } }).window = { electronAPI: api }
})

function makeResult(
  wallpaper: ThemeStepResult,
  taskbar: ThemeStepResult,
  dock: ThemeStepResult,
): ApplyThemeResult {
  return { themeId: 'cyber', wallpaper, taskbar, dock }
}

describe('getApplyThemeFeedback', () => {
  it('全部应用成功时返回 success 并列出已应用项', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getApplyThemeFeedback(
      makeResult({ status: 'applied' }, { status: 'applied' }, { status: 'applied' }),
    )
    expect(feedback.tone).toBe('success')
    expect(feedback.title).toBe('风格包已应用')
    expect(feedback.description).toContain('壁纸')
    expect(feedback.description).toContain('Dock')
  })

  it('跳过项（资源缺失）不计入失败，仍返回 success', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getApplyThemeFeedback(
      makeResult(
        { status: 'applied' },
        { status: 'skipped', message: '风格包未包含任务栏配置' },
        { status: 'skipped', message: '风格包未包含 Dock 配置' },
      ),
    )
    expect(feedback.tone).toBe('success')
    expect(feedback.description).toBe('已应用：壁纸')
  })

  it('存在失败项时返回 warning 并标注成功/失败分项', async () => {
    const mod = await import('@renderer/store/beautifyStore')
    const feedback = mod.getApplyThemeFeedback(
      makeResult(
        { status: 'applied' },
        { status: 'applied' },
        { status: 'failed', message: 'Nexus 未安装' },
      ),
    )
    expect(feedback.tone).toBe('warning')
    expect(feedback.title).toBe('风格包部分应用成功')
    expect(feedback.description).toContain('成功：壁纸、任务栏')
    expect(feedback.description).toContain('失败：Dock')
  })
})
