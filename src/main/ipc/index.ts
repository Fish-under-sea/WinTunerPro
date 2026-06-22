import { registerAppHandlers } from './appHandlers'
import { registerHardwareHandlers } from './hardwareHandlers'
import { registerGpuHandlers } from './gpuHandlers'
import { registerOemHandlers } from './oemHandlers'
import { registerOptimizationHandlers } from './optimizationHandlers'
import { registerPowerHandlers } from './powerHandlers'
import { registerReinstallHandlers } from './reinstallHandlers'
import { registerBeautifyHandlers } from './beautifyHandlers'
import { registerWallpaperHandlers } from './wallpaperHandlers'
import { registerBackupHandlers } from './backupHandlers'

/**
 * IPC 处理器集中注册入口。
 *
 * 每个功能模块在 `src/main/ipc/` 下新建一个 `xxxHandlers.ts`，
 * 导出 `registerXxxHandlers()`，再在此处调用。
 * 处理器只做参数校验 + 调用 services，业务逻辑放 `src/main/services/`。
 */
export function registerIpcHandlers(): void {
  registerAppHandlers()
  registerHardwareHandlers()
  registerGpuHandlers()
  registerOemHandlers()
  registerOptimizationHandlers()
  registerPowerHandlers()
  registerReinstallHandlers()
  registerBeautifyHandlers()
  registerWallpaperHandlers()
  registerBackupHandlers()
}
