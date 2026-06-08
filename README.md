# WinTuner Pro

> 游戏陪玩系统一键优化工具 · v1.0（开发中）
>
> 让每一位陪玩都能发挥出最佳状态。

## 项目简介

WinTuner Pro 是一款面向**游戏陪玩从业者与小型工作室（3-10 人）**的 Windows 桌面优化工具。它把原本需要 IT 技术人员才能完成的「系统重装 + 优化 + 美化」全流程，整合进一个**可视化、傻瓜式**的应用，让技术小白也能一键完成。

与 DISM++ 等面向技术人员的工具不同，WinTuner Pro 面向小白用户，全程可视化引导、零命令行操作、纯软方案无需 PE 盘。

### 设计原则

- **零门槛**：无需理解技术原理，全程引导。
- **纯软方案**：不依赖 PE 盘或外部引导介质。
- **可恢复**：写系统前自动备份，支持一键还原。
- **合规边界**：仅做系统初始化与优化，不涉及任何反作弊绕过逻辑。

## 核心功能

| 模块 | 说明 |
| --- | --- |
| 系统重装与初始化 | 纯软部署 Win10/11 LTSC，DISM + RunOnce 重启续执行，SID 重置、驱动与运行库自动补全 |
| 显卡竞技调优 | 自动识别 N 卡 / A 卡，一键写入竞技预设（垂直同步、低延迟、电源模式等） |
| OEM 性能调度 ⭐ | 核心差异化：自动识别游戏本品牌，解锁「增强 / 狂暴模式」，引导 MUX 独显直连 |
| 系统优化 | 服务与启动项清理、网络优化（DNS/TCP/MTU）、电源性能、存储内存 |
| 系统美化 | 风格包（赛博/简约/电竞）、壁纸、图标、字体，对接 Windhawk / Nexus 生态 |
| 配置备份与迁移 | 注册表快照 + 加密 `.wtp` 配置文件，支持跨机器批量部署 |

## 技术栈

| 层 | 技术 | 职责 |
| --- | --- | --- |
| UI 层 | Electron + React + TypeScript | 界面渲染、交互、进度展示 |
| 通信层 | Electron IPC | 主进程 ↔ 渲染进程指令传递 |
| 执行层 | Node.js `child_process` | 在主进程调用 PowerShell |
| 脚本层 | PowerShell 5.1 / 7.x | WMI 查询、注册表读写、驱动安装 |
| 资源层 | 本地离线包 | 无网络也可完整运行 |

构建工具：Vite；打包：electron-builder。

## 目录结构

```
WinTunerPro/
├── src/                  应用源码
│   ├── main/             Electron 主进程（生命周期、窗口、IPC、调度）
│   │   ├── ipc/          IPC 通道处理器（按模块拆分）
│   │   └── services/     主进程业务服务（脚本调度、备份、硬件检测）
│   ├── preload/          预加载脚本（contextBridge 暴露白名单 API）
│   ├── renderer/         React UI
│   │   ├── pages/        页面（仪表盘、重装、调优、调度、优化、美化、备份、设置）
│   │   ├── components/   可复用组件
│   │   ├── store/        状态管理
│   │   ├── styles/       样式与主题
│   │   └── assets/       UI 静态资源
│   └── shared/           主/渲共享代码
│       ├── types/        TS 类型定义（数据契约）
│       └── constants/    常量（IPC 通道名等）
├── scripts/              PowerShell 脚本层
│   ├── system/           系统重装、初始化、优化
│   ├── gpu/              N 卡 / A 卡调优
│   ├── oem/              各品牌 OEM 调度（按品牌拆文件）
│   └── common/           公共函数（备份、日志、WMI 封装）
├── resources/            离线资源（默认不入库，见 .gitignore）
│   ├── drivers/          离线驱动包
│   ├── runtimes/         VC++ / .NET / DirectX
│   ├── themes/           美化风格包
│   └── fonts/            中文字体
├── build/                打包配置、图标、Windows manifest
├── docs/                 设计文档与模块说明
├── tests/                测试
├── package.json          依赖与脚本（占位，依赖待脚手架补全）
└── .gitignore
```

## 开发环境与运行

> 当前仓库处于**初期奠基阶段**，仅搭建了目录骨架与开发规则，尚无可运行的实现代码。以下为环境与运行的占位说明，待脚手架落地后完善。

### 环境要求

- 操作系统：**Windows 10 / 11**（功能强依赖 Windows API、WMI、注册表、PowerShell，不跨平台）。
- Node.js LTS（≥ 18）+ npm。
- PowerShell 5.1 或 7.x。
- 调试系统级功能需以**管理员身份**运行；建议在可还原的虚拟机中测试高风险操作。

### 运行（脚手架落地后）

```powershell
# 安装依赖（依赖清单待补全，使用 npm install 安装最新稳定版）
npm install

# 启动开发模式（Vite + Electron 热重载）
npm run dev

# 构建
npm run build

# 打包为 Windows 安装包
npm run package
```

> 依赖版本不在文档中凭空锁定；实际依赖通过包管理器安装后由 `package-lock.json` 固化。

## 更多文档

详细内容已拆分至 `docs/`，README 仅保留索引：

- [开发路线](docs/roadmap.md)：P0~Beta 各阶段的周期与目标。
- [开发规范](docs/conventions.md)：`.cursor/rules/` 下各规则文件的职责。
- [安全与合规](docs/security-compliance.md)：权限模型、进程隔离、备份回滚与合规边界。
