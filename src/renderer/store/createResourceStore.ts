import { create } from 'zustand'
import type { UseBoundStore, StoreApi } from 'zustand'
import { errorMessage } from '@renderer/lib/async'

/**
 * 只读资源的统一三态（loading / error / data）。
 * 各只读模块（getXxx / listXxx / detectXxx）通过 createResourceStore 复用此形状。
 */
export interface ResourceState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** 是否已成功加载过一次（用于避免重复请求） */
  loaded: boolean
  /** 拉取数据；force=true 时强制刷新 */
  load: (force?: boolean) => Promise<void>
}

/**
 * 资源 store 工厂：传入一个异步取数函数，得到带统一三态的 zustand store。
 * 用法：`const useGpuStore = createResourceStore(() => window.electronAPI.detectGpu())`
 */
export function createResourceStore<T>(
  fetcher: () => Promise<T>,
): UseBoundStore<StoreApi<ResourceState<T>>> {
  return create<ResourceState<T>>((set, get) => ({
    data: null,
    loading: false,
    error: null,
    loaded: false,
    load: async (force = false) => {
      const { loading, loaded } = get()
      if (loading) return
      if (loaded && !force) return
      set({ loading: true, error: null })
      try {
        const data = await fetcher()
        set({ data, loading: false, loaded: true })
      } catch (err) {
        set({ error: errorMessage(err), loading: false })
      }
    },
  }))
}
