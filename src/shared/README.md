# src/shared —— 跨进程共享代码

主进程、preload、渲染进程三端共用的类型与常量，避免重复定义、保证数据契约一致。

## 子目录

- `types/`：TypeScript 类型定义，按模块拆分（如 `gpu.ts`、`oem.ts`、`backup.ts`）。主进程 ↔ 渲染进程传递的数据结构、PowerShell 返回结构均在此定义并双方复用。
- `constants/`：常量定义，重点是 IPC 通道名（`模块:动作` 格式，如 `gpu:detect`、`oem:apply-mode`），禁止在调用处写裸字符串。
