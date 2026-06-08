# src/renderer —— React 渲染进程（UI）

承载全部界面与交互。深色主题为主，蓝色主色调（#1A56DB），信息密度适中，重点突出进度与状态。

## 子目录

- `pages/`：页面级组件，对应 PRD 的主要页面（仪表盘、系统重装、显卡调优、性能调度、系统优化、系统美化、备份迁移、设置）。
- `components/`：可复用 UI 组件。
- `store/`：前端状态管理。
- `styles/`：全局样式与主题。
- `assets/`：UI 静态资源（图标、图片等）。

## 约定

- 只能通过 preload 暴露的 `window.electronAPI` 与主进程通信，**禁止** import `electron` / `fs` / `child_process` 等模块。
- 所有耗时操作必须展示进度条 + 阶段文案；错误用「人话」提示并提供「重试 / 跳过」。
