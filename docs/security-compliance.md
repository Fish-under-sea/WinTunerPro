# 安全与合规

> 本文档汇总 WinTuner Pro 在权限、进程隔离、备份回滚与合规边界上的约束。

## 安全约束

- 应用以管理员权限运行（manifest 声明 `requireAdministrator`）。
- 渲染进程开启 `contextIsolation`、禁用 `nodeIntegration`，系统操作经 preload + IPC 转交主进程。
- 写系统操作前自动备份至 `%AppData%\WinTunerPro\backups`，支持回滚。
- 不提交任何密钥、证书、产品密钥；仅做系统优化，不涉及违规逻辑。
