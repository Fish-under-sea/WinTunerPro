import type { Variants, Transition } from 'framer-motion'

/**
 * 全局 framer-motion 动效预设（克制、统一）。
 * 浅色清爽风下动效点到为止：短时长、平滑缓出，避免夸张位移。
 */

/** 统一缓动曲线（与 tailwind 的 ease-out 对齐） */
export const EASE_OUT: Transition['ease'] = [0.16, 1, 0.3, 1]

/** 页面级进入/退出（路由切换用） */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18, ease: EASE_OUT } },
}

/** 列表容器：子项依次入场 */
export const staggerContainer: Variants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
}

/** 列表子项：轻微上浮淡入 */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
}

/** 弹层（Modal/Toast）缩放淡入 */
export const popVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  enter: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.14, ease: EASE_OUT } },
}
