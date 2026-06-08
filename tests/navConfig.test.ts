import { describe, it, expect } from 'vitest'
import { NAV_ITEMS } from '@renderer/navConfig'

// 脚手架自检：导航配置作为路由与侧边栏的单一来源，路径必须唯一。
describe('navConfig', () => {
  it('包含九个页面项', () => {
    expect(NAV_ITEMS).toHaveLength(9)
  })

  it('所有路由路径互不重复', () => {
    const paths = NAV_ITEMS.map((item) => item.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('每项都有非空的中文标签', () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.trim().length).toBeGreaterThan(0)
    }
  })
})
