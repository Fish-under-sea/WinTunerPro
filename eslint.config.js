const js = require('@eslint/js')
const tseslint = require('@typescript-eslint/eslint-plugin')
const tsparser = require('@typescript-eslint/parser')
const reactPlugin = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const prettierPlugin = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')

/**
 * ESLint 扁平配置（ESLint 9）。
 * 对 main / preload / renderer 三端 TS 代码生效，并通过 no-restricted-imports
 * 强制进程边界：渲染进程禁止直接 import Node/系统模块。
 */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'release/**',
      'resources/**',
      '**/*.js',
      '**/*.cjs',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooks,
      prettier: prettierPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // TS 自身负责未定义变量检查，关闭 no-undef 避免误报 window/process 等
      'no-undef': 'off',
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // 进程边界：渲染进程只能通过 window.electronAPI 与主进程通信，
  // 禁止直接引入 electron 与 Node 系统模块（见 code-organization.mdc）
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'electron', message: '渲染进程禁止直接引入 electron，请通过 window.electronAPI。' },
            { name: 'fs', message: '渲染进程禁止访问文件系统，请走 IPC 交由主进程处理。' },
            { name: 'child_process', message: '渲染进程禁止执行子进程，请走 IPC 交由主进程处理。' },
            { name: 'os', message: '渲染进程禁止直接访问系统信息，请走 IPC。' },
          ],
          patterns: [
            { group: ['node:*'], message: '渲染进程禁止引入 Node 内建模块。' },
            { group: ['@main/*', '**/main/*'], message: '渲染进程禁止跨进程边界引入主进程代码。' },
          ],
        },
      ],
    },
  },
  // React 组件中的 hooks 规则
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',
    },
  },
  prettierConfig,
]
