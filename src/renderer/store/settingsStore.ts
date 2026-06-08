import { createResourceStore } from './createResourceStore'

/** 应用信息 store（只读，getAppVersion），供设置页与仪表盘使用。 */
export const useAppInfoStore = createResourceStore(() => window.electronAPI.getAppVersion())
