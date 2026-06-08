# src/main —— Electron 主进程

负责应用生命周期、窗口管理、IPC 处理与系统操作调度。这是唯一允许调用 Node.js 与系统能力的进程。

## 子目录

- `ipc/`：IPC 通道处理器，按功能模块拆分（system / gpu / oem / optimize / theme / backup）。处理器只做参数校验后调用 `services`。
- `services/`：主进程业务服务，封装 PowerShell 脚本调度、硬件检测、备份还原等核心逻辑。

## 约定

- 所有系统级操作通过 `child_process` 调用 `scripts/` 下的 PowerShell 脚本完成。
- 执行写系统操作前必须先生成备份（见 `scripts/common`）。
- 对来自渲染进程的参数做白名单校验，避免命令注入。
