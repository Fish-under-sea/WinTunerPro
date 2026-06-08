import { join } from 'node:path'
import { app, shell, BrowserWindow } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'

/**
 * 创建主窗口。
 * 安全模型（见 project-overview.mdc / code-organization.mdc）：
 *   - contextIsolation: true   隔离渲染进程与 preload 上下文
 *   - nodeIntegration: false   渲染进程不可直接访问 Node
 *   一切系统操作经 preload 白名单 API + IPC 转交主进程。
 */
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 外部链接走系统浏览器，不在应用内打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发模式加载 Vite Dev Server（支持 HMR），生产模式加载打包后的 HTML
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fishundersea.wintunerpro')

  // 开发期：F12 开关 DevTools，生产期忽略 CmdOrCtrl+R 等快捷键
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 注册所有 IPC 处理器（按模块拆分，集中入口）
  registerIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 本项目仅 Windows，所有窗口关闭即退出
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
