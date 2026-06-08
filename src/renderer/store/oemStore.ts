import { createResourceStore } from './createResourceStore'

/** OEM 检测 store（只读，detectOem）。 */
export const useOemStore = createResourceStore(() => window.electronAPI.detectOem())
