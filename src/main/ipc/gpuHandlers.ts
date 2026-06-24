import { ipcMain } from 'electron'
import { GPU_CHANNELS } from '@shared/constants/ipcChannels'
import type { GpuTweakOptionId, NvidiaPresetId } from '@shared/types/gpu'
import { detectGpu, applyNvidiaPreset, applyGpuTweaks, listGpuTweakOptions, getNvidiaProfileStatus } from '../services/gpuService'

/**
 * gpu 模块 IPC 处理器。
 */
export function registerGpuHandlers(): void {
  ipcMain.handle(GPU_CHANNELS.DETECT, () => detectGpu())
  ipcMain.handle(GPU_CHANNELS.LIST_TWEAK_OPTIONS, () => listGpuTweakOptions())
  ipcMain.handle(GPU_CHANNELS.APPLY_TWEAKS, (_event, optionIds: GpuTweakOptionId[]) =>
    applyGpuTweaks(optionIds),
  )
  ipcMain.handle(GPU_CHANNELS.APPLY_NVIDIA_PRESET, (_event, presetId: NvidiaPresetId) =>
    applyNvidiaPreset(presetId),
  )
  ipcMain.handle(GPU_CHANNELS.GET_NVIDIA_PROFILE_STATUS, () => getNvidiaProfileStatus())
}
