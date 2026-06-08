import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite 对 main / preload / renderer 三端分别编译，并提供主进程与渲染进程的 HMR。
// 入口遵循默认约定：
//   主进程    src/main/index.ts
//   预加载    src/preload/index.ts
//   渲染进程  src/renderer/index.html
export default defineConfig({
  main: {
    // externalizeDepsPlugin 将 dependencies 外部化，避免把 Node 原生模块打进 bundle
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    // 渲染进程根目录指向 src/renderer，index.html 位于其下
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
        },
      },
    },
  },
})
