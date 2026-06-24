import { describe, expect, it } from 'vitest'
import {
  NEXUS_DEPLOY_CONVENTION,
  NEXUS_WBK_SECTION_TO_SUBKEY,
  buildNexusDeployManifest,
  isNexusShortcutKey,
  partitionNexusBackupKeys,
  pickNexusConfigSource,
  resolveNexusConfigFormat,
} from '@shared/types/beautify'

describe('resolveNexusConfigFormat', () => {
  it('识别 .reg / .wbk（大小写不敏感），其余返回 null', () => {
    expect(resolveNexusConfigFormat('nexus.reg')).toBe('reg')
    expect(resolveNexusConfigFormat('nexus.wbk')).toBe('wbk')
    expect(resolveNexusConfigFormat('NEXUS.REG')).toBe('reg')
    expect(resolveNexusConfigFormat('wsbackup.WBK')).toBe('wbk')
    expect(resolveNexusConfigFormat('translucenttb.json')).toBeNull()
    expect(resolveNexusConfigFormat('nexus')).toBeNull()
  })
})

describe('pickNexusConfigSource（扩展名分流：reg 优先于 wbk）', () => {
  it('同时存在 .reg 与 .wbk 时优先选 .reg（最稳、落点已验证）', () => {
    const picked = pickNexusConfigSource(['nexus.wbk', 'nexus.reg'])
    expect(picked).toEqual({ fileName: 'nexus.reg', format: 'reg' })
  })

  it('仅有 .wbk 时选 .wbk', () => {
    const picked = pickNexusConfigSource(['nexus.wbk'])
    expect(picked).toEqual({ fileName: 'nexus.wbk', format: 'wbk' })
  })

  it('无可识别预设时返回 null', () => {
    expect(pickNexusConfigSource(['wallpaper.jpg', 'translucenttb.json'])).toBeNull()
    expect(pickNexusConfigSource([])).toBeNull()
  })
})

describe('NEXUS_WBK_SECTION_TO_SUBKEY（.wbk 段→子键 数据契约）', () => {
  it('已验证段落映射到正确子键', () => {
    expect(NEXUS_WBK_SECTION_TO_SUBKEY.WORKSHELF).toBe('NeXuS')
    expect(NEXUS_WBK_SECTION_TO_SUBKEY.SHARED).toBe('Shared')
  })

  it('DOCKS 段当前映射到 NeXuS（落点尚未上机验证）', () => {
    expect(NEXUS_WBK_SECTION_TO_SUBKEY.DOCKS).toBe('NeXuS')
  })
})

describe('buildNexusDeployManifest（资源清单组装）', () => {
  it('仅纳入约定表中且实际存在的子目录', () => {
    const manifest = buildNexusDeployManifest(['theme', 'icons'])
    expect(manifest).toEqual([
      { source: 'theme', target: 'PUBLIC_WINSTEP_THEMES' },
      { source: 'icons', target: 'PUBLIC_WINSTEP_ICONS' },
    ])
  })

  it('忽略未在约定表中的子目录', () => {
    const manifest = buildNexusDeployManifest(['theme', 'unknown-dir'])
    expect(manifest).toEqual([{ source: 'theme', target: 'PUBLIC_WINSTEP_THEMES' }])
  })

  it('子目录名大小写不敏感', () => {
    const manifest = buildNexusDeployManifest(['Theme', 'ICONS'])
    expect(manifest.map((e) => e.source)).toEqual(['theme', 'icons'])
  })

  it('无匹配子目录时返回空数组', () => {
    expect(buildNexusDeployManifest([])).toEqual([])
    expect(buildNexusDeployManifest(['foo', 'bar'])).toEqual([])
  })

  it('即使预设包内存在 shortcuts/ 子目录也不铺设（约定表已移除快捷方式）', () => {
    expect(buildNexusDeployManifest(['shortcuts'])).toEqual([])
    expect(buildNexusDeployManifest(['theme', 'shortcuts'])).toEqual([
      { source: 'theme', target: 'PUBLIC_WINSTEP_THEMES' },
    ])
  })

  it('约定表只含 UI 外观资源（theme / icons），不含 shortcuts', () => {
    expect(NEXUS_DEPLOY_CONVENTION.map((e) => e.source)).toEqual(['theme', 'icons'])
    expect(NEXUS_DEPLOY_CONVENTION.some((e) => e.source === 'shortcuts')).toBe(false)
  })

  it('返回的清单是约定表的子集（不臆造映射）', () => {
    const all = buildNexusDeployManifest(NEXUS_DEPLOY_CONVENTION.map((e) => e.source))
    expect(all).toEqual([...NEXUS_DEPLOY_CONVENTION])
  })
})

describe('isNexusShortcutKey（.wbk 快捷方式项判定，键名取自真实 wsbackup.wbk）', () => {
  it('[DOCKS] 段每个 Dock 图标条目项（以数字开头）判为快捷方式 → 跳过', () => {
    // 取自真实 wbk：1Label0=此电脑 / 1Path0=...\此电脑.lnk / 1StartPath0 / 1Type0 / 1Hotkey2
    for (const key of [
      '1Label0',
      '1Path0',
      '1StartPath0',
      '1Type0',
      '1Label1',
      '1Path1',
      '1Type1',
      '1Hotkey2',
      '1Label7',
      '1Path7',
      '1Hotkey7',
    ]) {
      expect(isNexusShortcutKey(key)).toBe(true)
    }
  })

  it('Dock 条目计数 DockNoItems<n> 也跳过（避免只写计数不写条目）', () => {
    expect(isNexusShortcutKey('DockNoItems1')).toBe(true)
    expect(isNexusShortcutKey('DockNoItems10')).toBe(true)
  })

  it('Dock 外观/尺寸/动效/位置等 UI 键不判为快捷方式 → 写入对齐', () => {
    // 取自真实 wbk [DOCKS] 段：均以字母（Dock/NeXuS/NoDocks）开头
    for (const key of [
      'DockIconSize1',
      'DockFxEffect1',
      'DockMagPixels1',
      'DockPosX1',
      'DockOrientation1',
      'DockFontName1',
      'DockBitmapFolder1',
      'DockBack3Image1',
      'DockName1',
      'DockNSID1',
      'NeXuS',
      'NoDocks',
    ]) {
      expect(isNexusShortcutKey(key)).toBe(false)
    }
  })

  it('[WORKSHELF]/[SHARED] 的 UI/行为键均保留（不以数字开头）', () => {
    // 取自真实 wbk：主题名、动效、时钟/天气、Win7 任务栏模式、共享设置等
    for (const key of [
      'NeXuSThemeName',
      'GenThemeName',
      'Win7TaskbarMode',
      'AnimationSpeed',
      'FxSpan00',
      'FxTime38',
      'SoundFx00',
      'ClockStyle',
      'METARCity',
      'HasSharedSection',
      'Windows10Style',
      'SnapshotName1',
    ]) {
      expect(isNexusShortcutKey(key)).toBe(false)
    }
  })
})

describe('partitionNexusBackupKeys（UI 设置 / 快捷方式项 二分）', () => {
  it('按规则把真实 [DOCKS] 键二分，统计写入 N / 跳过 M', () => {
    // 模拟真实 wbk [DOCKS] 段中一段连续键：UI 设置 + 一个完整 Dock 图标条目
    const keys = [
      'DockIconSize1', // UI
      'DockFxEffect1', // UI
      'DockNoItems1', // 跳过（条目计数）
      '1Label0', // 跳过（条目）
      '1Path0', // 跳过（条目，指向 .lnk）
      '1StartPath0', // 跳过（条目）
      '1Type0', // 跳过（条目）
    ]
    const { uiKeys, shortcutKeys } = partitionNexusBackupKeys(keys)
    expect(uiKeys).toEqual(['DockIconSize1', 'DockFxEffect1'])
    expect(shortcutKeys).toEqual(['DockNoItems1', '1Label0', '1Path0', '1StartPath0', '1Type0'])
    expect(uiKeys.length).toBe(2)
    expect(shortcutKeys.length).toBe(5)
  })

  it('纯 UI 段（如 [WORKSHELF]）不产生跳过项', () => {
    const keys = ['NeXuSThemeName', 'Win7TaskbarMode', 'AnimationSpeed', 'FxSpan00']
    const { uiKeys, shortcutKeys } = partitionNexusBackupKeys(keys)
    expect(shortcutKeys).toEqual([])
    expect(uiKeys).toEqual(keys)
  })
})
