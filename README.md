# WinTuner Pro

> 游戏陪玩系统一键优化工具 · v0.2.2
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
| 系统美化 | Nexus UI 预设、TranslucentTB 任务栏、壁纸中心（静态 / Wallpaper Engine），离线资源随包分发 |
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
│   │   ├── ipc/          IPC 通道处理器（gpu / oem / beautify / wallpaper 等）
│   │   └── services/     主进程业务服务（脚本调度、硬件检测、备份等）
│   ├── preload/          预加载脚本（contextBridge 暴露白名单 API）
│   ├── renderer/         React UI
│   │   ├── pages/        页面（仪表盘、硬件、显卡、OEM、优化、重装、美化、壁纸、备份、设置）
│   │   ├── components/   可复用组件
│   │   ├── store/        状态管理（Zustand）
│   │   ├── styles/       全局样式
│   │   └── layouts/      页面布局
│   └── shared/           主/渲共享代码
│       ├── types/        TS 类型定义（数据契约）
│       ├── constants/    常量（IPC 通道名等）
│       └── utils/        跨端工具函数
├── scripts/              PowerShell 脚本层（随安装包分发）
│   ├── system/           系统信息、重装、电源与一键优化
│   ├── gpu/              显卡检测与竞技调优（NVIDIA Profile Inspector 预设等）
│   ├── oem/              各品牌 OEM 性能调度
│   ├── beautify/         Nexus / TranslucentTB 安装与配置（含 _BeautifyCommon.ps1）
│   ├── wallpaper/        壁纸状态查询与静态壁纸设置
│   ├── backup/           注册表快照备份与还原
│   └── common/           全局公共函数（WtCommon.ps1：日志、WMI 等）
├── resources/            离线资源（大文件默认不入库，见 .gitignore）
│   ├── drivers/          离线驱动包
│   ├── runtimes/         VC++ / .NET / DirectX
│   ├── themes/           Nexus 离线安装包、wsbackup.wbk 等美化资源
│   └── fonts/            中文字体
├── build/                应用图标与 Windows manifest
│   ├── icon.ico          应用图标
│   └── win/              UAC 提权 manifest（requireAdministrator）
├── electron-builder.yml  electron-builder 打包配置（输出至 release/）
├── docs/                 设计文档与模块说明
├── tests/                Vitest 单元测试
├── package.json          依赖与 npm 脚本（dev / build / package / test 等）
└── .gitignore
```

## 下载

预编译安装包见 [GitHub Releases](https://github.com/Fish-under-sea/WinTunerPro/releases)（当前最新 v0.2.2）。离线大资源（`resources/` 下驱动、主题包等）需按 `resources/README.md` 自行放置后重新打包，或使用已内置资源的发布包。

## 开发环境与运行

### 环境要求

- 操作系统：**Windows 10 / 11**（功能强依赖 Windows API、WMI、注册表、PowerShell，不跨平台）。
- Node.js LTS（≥ 18）+ npm。
- PowerShell 5.1 或 7.x。
- 调试系统级功能需以**管理员身份**运行；建议在可还原的虚拟机中测试高风险操作。

### 本地运行

```powershell
# 安装依赖
npm install

# 启动开发模式（electron-vite 热重载）
npm run dev

# 类型检查 + 构建
npm run build

# 打包为 Windows 安装包（输出至 release/）
npm run package

# 单元测试
npm test
```

> 依赖版本由 `package-lock.json` 锁定；`build/_icon_preview*.png` 为本地图标预览模板，已 `.gitignore` 忽略。

## 更多文档

详细内容已拆分至 `docs/`，README 仅保留索引：

- [开发路线](docs/roadmap.md)：P0~Beta 各阶段的周期与目标。
- [开发规范](docs/conventions.md)：`.cursor/rules/` 下各规则文件的职责。
- [安全与合规](docs/security-compliance.md)：权限模型、进程隔离、备份回滚与合规边界。
