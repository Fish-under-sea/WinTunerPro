import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { NAV_ITEMS } from '@renderer/navConfig'
import { Icon } from '@renderer/components/icons'
import { Toaster } from '@renderer/components/ui'
import { cn } from '@renderer/lib/cn'
import { pageVariants } from '@renderer/lib/motion'
import { useAppInfoStore } from '@renderer/store/settingsStore'

/**
 * 主布局：左侧固定导航栏（分组） + 右侧路由内容区。
 * 导航项来自 navConfig，自动渲染并按 group 分组；页面切换带轻微淡入上浮动效。
 */
export function MainLayout(): React.JSX.Element {
  const location = useLocation()

  // 左下角版本号取自主进程 app.getVersion()，避免写死与 package.json 脱节
  const appVersion = useAppInfoStore((s) => s.data?.version)
  const loadAppInfo = useAppInfoStore((s) => s.load)
  useEffect(() => {
    void loadAppInfo()
  }, [loadAppInfo])

  // 按 group 归并导航项，保持 navConfig 中的出现顺序
  const groups: { group: string; items: typeof NAV_ITEMS }[] = []
  for (const item of NAV_ITEMS) {
    const existing = groups.find((g) => g.group === item.group)
    if (existing) existing.items.push(item)
    else groups.push({ group: item.group, items: [item] })
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-contrast shadow-primary">
            <Icon name="zap" size={20} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-text">
              WinTuner <span className="text-primary">Pro</span>
            </div>
            <div className="text-[11px] text-text-subtle">一键优化 · 零门槛</div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
          {groups.map((group) => (
            <div key={group.group}>
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                {group.group}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-fast ease-smooth',
                        isActive
                          ? 'bg-primary-soft text-primary'
                          : 'text-text-muted hover:bg-surface-hover hover:text-text',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={item.icon}
                          size={18}
                          className={cn(
                            isActive
                              ? 'text-primary'
                              : 'text-text-subtle group-hover:text-text-muted',
                          )}
                        />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-text-subtle">
          <span>{appVersion ? `v${appVersion}` : ''}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            开发中
          </span>
        </footer>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className="mx-auto max-w-6xl px-8 py-8"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <Toaster />
    </div>
  )
}
