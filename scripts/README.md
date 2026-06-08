# scripts —— PowerShell 脚本层

所有系统级操作的实际执行者，由主进程通过 `child_process` 调用。脚本运行于提升权限（管理员）下。

## 子目录

- `system/`：系统重装、初始化、服务/电源/网络/存储优化脚本。
- `gpu/`：NVIDIA / AMD 显卡竞技调优脚本。
- `oem/`：各品牌 OEM 性能调度脚本，按品牌拆文件（Lenovo / Asus / HP / Dell / Razer / 机械革命 / 机械师 / 神舟 等）。
- `common/`：公共函数（配置/注册表备份、日志、WMI 查询封装等）。

## 约定

- 文件名用 `动词-名词.ps1`（如 `Get-VideoController.ps1`、`Set-NvidiaPreset.ps1`），函数遵循 PowerShell `Verb-Noun` 规范。
- 输出结构化数据（推荐 `ConvertTo-Json`）供主进程解析；进度信息单独成行便于实时捕获。
- 写注册表 / 服务 / 电源 / 驱动前，必须先调用 `common` 的备份函数生成 `.reg` 或快照。
- 脚本要可重入、可中断恢复，失败返回明确错误码。
