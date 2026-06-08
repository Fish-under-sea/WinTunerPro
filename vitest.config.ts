import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Vitest 独立配置：复用三端别名，单元测试默认跑在 node 环境。
// 涉及 DOM 的组件测试可在对应文件用 // @vitest-environment jsdom 覆盖。
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer'),
      '@main': resolve('src/main'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
