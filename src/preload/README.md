# src/preload —— 预加载脚本

渲染进程与主进程之间的唯一安全桥梁。

## 约定

- 通过 `contextBridge.exposeInMainWorld` 向渲染进程暴露**白名单 API**（如 `window.electronAPI`）。
- 禁止直接透传整个 `ipcRenderer`，只暴露明确需要的方法。
- 配合主进程开启 `contextIsolation: true`、`nodeIntegration: false`，确保渲染进程无法直接触碰 Node/系统能力。
