/**
 * gpu 模块共享类型——显卡检测（数据契约）。
 *
 * 对应 WMI 来源：Win32_VideoController（名称、AdapterRAM、DriverVersion、PNPDeviceID 判厂商）。
 * 核显判定可结合 PNPDeviceID / 名称关键字。检测结果用于后续 N 卡 / A 卡分流调优。
 */

/** 显卡厂商 */
export type GpuVendor = 'NVIDIA' | 'AMD' | 'Intel' | 'Unknown'

/** 单块显卡信息 */
export interface GpuInfo {
  /** 显卡名称，如 “NVIDIA GeForce RTX 4060 Laptop GPU” */
  name: string
  /** 厂商 */
  vendor: GpuVendor
  /** 显存大小（MB） */
  vramMB: number
  /** 驱动版本 */
  driverVersion: string
  /** 是否核显（集成显卡） */
  isIntegrated: boolean
}

/** 显卡检测结果（`gpu:detect` 返回结构） */
export interface GpuDetectResult {
  /** 检测到的全部显卡 */
  gpus: GpuInfo[]
  /** 主显卡厂商（用于决定走哪套竞技预设） */
  primaryVendor: GpuVendor
}
