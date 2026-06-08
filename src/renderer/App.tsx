import { HashRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@renderer/layouts/MainLayout'
import { DashboardPage } from '@renderer/pages/DashboardPage'
import { HardwarePage } from '@renderer/pages/HardwarePage'
import { GpuTuningPage } from '@renderer/pages/GpuTuningPage'
import { OemSchedulerPage } from '@renderer/pages/OemSchedulerPage'
import { SystemReinstallPage } from '@renderer/pages/SystemReinstallPage'
import { OptimizationPage } from '@renderer/pages/OptimizationPage'
import { BeautifyPage } from '@renderer/pages/BeautifyPage'
import { WallpaperPage } from '@renderer/pages/WallpaperPage'
import { BackupPage } from '@renderer/pages/BackupPage'
import { SettingsPage } from '@renderer/pages/SettingsPage'

/**
 * 应用根组件与路由表。
 * 使用 HashRouter：生产环境经 file:// 加载 HTML，hash 路由可避免路径解析问题。
 * 路由路径需与 navConfig.ts 的 NAV_ITEMS 对齐。
 */
export function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="hardware" element={<HardwarePage />} />
          <Route path="gpu" element={<GpuTuningPage />} />
          <Route path="oem" element={<OemSchedulerPage />} />
          <Route path="reinstall" element={<SystemReinstallPage />} />
          <Route path="optimization" element={<OptimizationPage />} />
          <Route path="beautify" element={<BeautifyPage />} />
          <Route path="wallpaper" element={<WallpaperPage />} />
          <Route path="backup" element={<BackupPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
