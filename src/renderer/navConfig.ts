import type { IconName } from '@renderer/components/icons'

/**
 * 侧边导航与路由的单一配置源。
 *
 * 新增页面：在此追加一项（path 唯一、label 中文菜单名、icon 取自图标库），
 * 再在 App.tsx 的路由表登记对应页面组件即可，导航栏会自动出现该项。
 */
export interface NavItem {
  /** 路由路径（相对，挂在 MainLayout 下） */
  path: string
  /** 侧边栏显示的中文名称 */
  label: string
  /** 图标名（见 components/icons.tsx 的图标库） */
  icon: IconName
  /** 分组标题（用于侧边栏分组展示） */
  group: string
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '仪表盘', icon: 'dashboard', group: '总览' },
  { path: '/hardware', label: '硬件信息', icon: 'cpu', group: '总览' },
  { path: '/gpu', label: '显卡调优', icon: 'gpu', group: '性能调优' },
  { path: '/oem', label: 'OEM 调度', icon: 'gauge', group: '性能调优' },
  { path: '/optimization', label: '系统优化', icon: 'zap', group: '性能调优' },
  { path: '/reinstall', label: '系统重装', icon: 'reinstall', group: '系统维护' },
  { path: '/beautify', label: '系统美化', icon: 'palette', group: '个性化' },
  { path: '/wallpaper', label: '壁纸中心', icon: 'image', group: '个性化' },
  { path: '/backup', label: '配置备份', icon: 'backup', group: '系统维护' },
  { path: '/settings', label: '设置', icon: 'settings', group: '其他' },
]
