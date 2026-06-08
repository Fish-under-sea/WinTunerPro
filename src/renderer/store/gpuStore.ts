import { createResourceStore } from './createResourceStore'

/** 显卡检测 store（只读，detectGpu）。 */
export const useGpuStore = createResourceStore(() => window.electronAPI.detectGpu())
