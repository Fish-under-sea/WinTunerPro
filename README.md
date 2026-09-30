> **⏸️ 暂停维护** · 最近提交：2026-06-24（约 3 个月前）
>
> 功能已推进到 v0.2.2，核心流程可用；后续排期取决于实际使用反馈，Bug 报告仍会查看。

<div align="center">

# WinTuner Pro

**游戏陪玩系统一键优化工具 · v0.2.2**

![Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-42-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)

让每一位陪玩都能发挥出最佳状态。

</div>

---

## 📖 项目简介

WinTuner Pro 是一款面向**游戏陪玩从业者与小型工作室（3-10 人）**的 Windows 桌面优化工具。它把原本需要 IT 技术人员才能完成的「系统重装 + 优化 + 美化」全流程，整合进一个**可视化、傻瓜式**的应用，让技术小白也能一键完成。

与 DISM++ 等面向技术人员的工具不同，WinTuner Pro 面向小白用户：全程可视化引导、零命令行操作、纯软方案无需 PE 盘。

## 🎯 四条设计原则

| 原则 | 含义 |
|------|------|
| **零门槛** | 全程图形界面引导，不需要记命令 |
| **纯软方案** | 不需要 PE 启动盘，不拆机 |
| **可恢复** | 高风险操作前自动备份，支持回滚 |
| **合规边界** | **不涉及任何反作弊绕过逻辑** |

## ✨ 功能模块（10 个页面）

| 模块 | 做什么 | 实现状态 |
|------|--------|:--------:|
| **仪表盘** | 系统概览与快捷入口 | ✅ |
| **硬件信息** | 读取设备与系统信息（`Get-SystemInfo.ps1` / `Get-DeviceInfo.ps1`） | ✅ |
| **显卡调优** | GPU 检测与调优预设（`Apply-GpuTweaks.ps1` / `Set-NvidiaProfile.ps1` / `Set-NvidiaPreset.ps1`） | ✅ NVIDIA 链路完整；**AMD 仅声明，未见专用脚本** |
| **OEM 调度** | 识别整机品牌并切换厂商性能模式（`Get-ChassisAndBrand.ps1` / `Set-OemPerformanceMode.ps1`） | ✅ 联想 / 华硕 / HP / Dell / Razer / 机械革命 / 机械师 / 神舟 |
| **系统优化** | 15 项白名单优化（见下表） | ⚠️ 部分项见下方「已知限制」 |
| **系统重装** | 镜像源管理、ISO 校验、**MachineGuid** 重置、部署进度 | ✅ |
| **系统美化** | 部署 TranslucentTB、Winstep Nexus 及预设 | ⚠️ 需自备离线安装包 |
| **壁纸中心** | 壁纸管理、Wallpaper Engine 检测与引导 | ✅ |
| **配置备份** | 备份快照 / 还原 / 导入导出 `.wtp` | ✅ |
| **设置** | 应用偏好 | ✅ |

### 系统优化白名单（15 项，逐字来自 `src/shared/types/optimization.ts`）

```
temp  ·  recycle  ·  wu-cache  ·  fileext  ·  power-ultimate
winsxs  ·  resetbase  ·  startup  ·  diagtrack  ·  ceip
autoplay  ·  telemetry  ·  xbox  ·  news  ·  tips
```

> ⚠️ **`resetbase` 是专家项，默认关闭**，红字警告 —— 执行后将**无法卸载已安装的 Windows 更新**。

## 🚀 下载与安装

从 Releases 获取最新安装包：

- **最新版**：[`WinTuner.Pro.Setup.0.2.2.exe`](https://github.com/Fish-under-sea/WinTunerPro/releases/download/v0.2.2/WinTuner.Pro.Setup.0.2.2.exe)（约 137 MB）
- 全部版本：[Releases 页](https://github.com/Fish-under-sea/WinTunerPro/releases)（v0.1.0 / 0.1.1 / 0.1.2 / 0.2.0 / 0.2.1 / 0.2.2）

**安装前须知**：

- 应用以**管理员权限**运行（manifest 声明 `requireAdministrator`）—— 系统级优化必需
- 安装包**未做代码签名**，Windows SmartScreen 可能提示，需手动允许
- `resources/` 下的离线大资源（驱动 / 字体 / 运行库）**不随仓库分发**，需自行放置后重新打包（见 [`resources/README.md`](resources/README.md)）

## 🛠️ 技术栈

| 层 | 实现 |
|----|------|
| 桌面框架 | **Electron 42**（主窗口 1280×832，`contextIsolation: true` / `nodeIntegration: false`） |
| UI | **React 19** + React Router 7 + Zustand 5 + Framer Motion 12 |
| 样式 | **Tailwind CSS 3.4**（主题全部走 CSS 变量，统一圆角阶梯 8/10/14/18px） |
| 构建 | **electron-vite 5** + Vite 7（main / preload / renderer 三端分别编译） |
| 语言 | **TypeScript 6** |
| 质量 | ESLint 9 + Prettier 3 + **Vitest 4**（9 个测试文件） |
| 打包 | **electron-builder 26** → NSIS 安装包，输出 `release/` |
| 执行层 | Node `child_process` → **PowerShell**（`scripts/**/*.ps1`） |

## 📦 可用命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发模式（三端编译 + HMR） |
| `npm start` | 预览已构建产物 |
| `npm run build` | 类型检查 + 三端构建 |
| `npm run build:unpack` | 免安装包（目录形态，便于自测） |
| `npm run package` | 生成 NSIS 安装包 → `release/` |
| `npm run typecheck` | `tsconfig.node.json` + `tsconfig.web.json` 联合类型检查 |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 检查并修复 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | Prettier 格式校验 |
| `npm test` | Vitest 单次执行 |

## 🖥️ 开发环境

| 项 | 要求 |
|----|------|
| 操作系统 | Windows 10 / 11（`package.json` 限定 `"os": ["win32"]`） |
| Node.js | ≥ 18（`engines` 声明） |
| PowerShell | 5.1 或 7.x |
| 权限 | 管理员（系统操作必需） |
| 测试建议 | **高风险 PowerShell 操作请在可还原的虚拟机中实测** |

## 📁 目录结构

```text
WinTunerPro/
├── build/                    icon.ico + win/app.manifest
├── docs/                     产品与工程文档
│   ├── roadmap.md            路线图
│   ├── security-compliance.md 安全与合规说明
│   ├── conventions.md        工程约定
│   ├── dismpp-reference.md   DISM++ 技术调研
│   └── WinTunerPro_PRD_v1.docx / Pitch_v3.pptx
├── resources/                离线资源（drivers/fonts/runtimes/themes，随仓库为空）
├── scripts/                  PowerShell 执行层
│   ├── backup/  beautify/  common/  gpu/  oem/  system/  wallpaper/
├── src/
│   ├── main/                 主进程（ipc/ 11 文件 + services/ 11 文件）
│   ├── preload/              白名单 IPC 桥
│   ├── renderer/             React 界面（pages/ 10 个 + store/ 12 个 + components/ui/ 19 个）
│   └── shared/               IPC 通道常量与类型
├── tests/                    9 个 Vitest 测试
├── electron-builder.yml      打包配置
└── electron.vite.config.ts   三端构建配置
```

## 🔒 安全与合规

| 措施 | 说明 |
|------|------|
| **自动备份** | 写入系统前备份至 `%AppData%\WinTunerPro\backups`；注册表操作前 `reg export` 生成 `.reg` 快照 |
| **IPC 白名单** | 渲染进程只能调用 preload 显式暴露的方法，不透传 `ipcRenderer`；主进程对参数做白名单校验，避免命令注入 |
| ⚠️ **隔离强度需知悉** | 渲染进程已开启 `contextIsolation` 并关闭 `nodeIntegration`，但 `sandbox: false`，且 preload 中存在「非隔离环境兜底挂 `window`」分支 —— 隔离强度**低于** Chromium 默认沙箱，安全文档中的「完全隔离」表述偏乐观 |
| **备份优先** | `scripts/README.md` 要求写注册表 / 服务 / 电源 / 驱动前必须先调 `common` 备份函数 |
| **红线** | `docs/dismpp-reference.md` 将「反作弊绕过 / 破解 / 规避检测」列为**禁止纳入**项 |
| **高风险二次确认** | 高风险项必须「备份 + 二次确认」；`ResetBase` 默认关闭并红字警告 |

## ⚠️ 已知限制（请务必先读）

> 这一节是**代码实测**的结论，与某些既有描述不一致 —— 我按实际实现如实列出。

| 项 | 实际情况 |
|----|---------|
| **「MachineGuid 重置」≠「SID 重置」** | 代码只重置 `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`（及可选遥测 ID）。机器 SID 在服务层**仅作展示**，**不会被修改** |
| **启动项清理未实现** | 优化脚本中 `startup` 项显式返回 `unimplemented`，提示「请在任务管理器中手动管理」 |
| **无「网络优化」模块** | 优化白名单 15 项与脚本中**均无** DNS / TCP / MTU 相关实现 |
| **`.wtp` 是混淆而非加密保护** | 容器魔术数 `WTP1` + AES-256-GCM，但源码自陈**密钥随应用内置**，属「落盘混淆 / 防误读」，**不是访问控制** |
| **风格包一键换肤已移除** | 该功能在 **v0.2.1 已移除**（`refactor: 移除风格包一键换肤功能并升级版本至 0.2.1`） |
| **美化模块有前提** | Winstep Nexus 需自备离线安装包（须放于 `resources/themes/nexus/`）；其 `[DOCKS]` 注册表预设「尚未上机验证」，**默认以 `-DryRun` 运行** |
| **离线资源为空** | `resources/**` 当前只有 `.gitkeep`；`extraResources` 打的是空目录，需自行放置后重新打包 |

## 🩹 出问题了怎么回滚

| 场景 | 做法 |
|------|------|
| 优化 / 美化改错 | 从 `%AppData%\WinTunerPro\backups` 还原备份快照 |
| 注册表写入 | 导入同目录下的 `.reg` 快照文件 |
| MachineGuid 变更后异常 | 部分软件可能需**重新激活**；`Set-MachineId.ps1` 有明确提示，变更后需重启 |
| 想撤销的应用层操作 | 配置备份页提供 `listBackups` / `restoreBackup` / `deleteBackup` |

## 📚 更多文档

| 文档 | 内容 |
|------|------|
| [`docs/roadmap.md`](docs/roadmap.md) | 路线图（P0 基础架构 → P1 系统优化 + N 卡 → P2 OEM + A 卡 → P3 重装 → P4 美化 / 备份 → Beta） |
| [`docs/security-compliance.md`](docs/security-compliance.md) | 安全与合规完整说明 |
| [`docs/conventions.md`](docs/conventions.md) | 工程约定 |
| [`docs/dismpp-reference.md`](docs/dismpp-reference.md) | DISM++ 技术调研与取舍依据 |
| [`docs/README.md`](docs/README.md) | 文档索引 |
| [`resources/README.md`](resources/README.md) | 离线资源放置说明（LTSC 镜像等大文件需自备，不随工具分发） |
| [`build/README.md`](build/README.md) · [`scripts/README.md`](scripts/README.md) · [`tests/README.md`](tests/README.md) | 各目录约定 |

## 📄 许可

本仓库**未附加开源许可证**（`package.json` 声明 `"license": "UNLICENSED"`）。

**请勿**将其视为开源项目自由使用或二次分发；如需授权请联系作者。

---

<sub>WinTuner Pro v0.2.2 · 面向游戏陪玩从业者与小型工作室 · 纯软方案，不涉及反作弊绕过</sub>