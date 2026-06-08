/**
 * hardware 模块共享类型——设备与系统信息（数据契约）。
 *
 * 对应 WMI 来源：Win32_OperatingSystem / Win32_ComputerSystem / Win32_Processor /
 * Win32_PhysicalMemory / Win32_BaseBoard / Win32_DiskDrive。
 * 主进程解析 PowerShell 输出后回传渲染进程，仅作展示与后续决策依据，不在此触发任何系统写操作。
 */

/** 操作系统信息（`hardware:get-system-info` 返回结构） */
export interface SystemInfo {
  /** OS 名称，如 “Windows 11 专业版” */
  osName: string
  /** OS 版本号，如 “23H2” */
  osVersion: string
  /** 内部版本号（build），如 “22631.4317” */
  buildNumber: string
  /** 版本分支 edition，如 “Professional” / “Enterprise LTSC” */
  edition: string
  /** 是否已激活，仅作展示用途，不影响功能流程 */
  activated: boolean
}

/** 单块磁盘信息 */
export interface DiskInfo {
  /** 磁盘型号 */
  model: string
  /** 容量（字节） */
  sizeBytes: number
  /** 介质类型：固态 / 机械 / 未知 */
  type: 'SSD' | 'HDD' | 'Unknown'
}

/** 设备硬件信息（`hardware:get-device-info` 返回结构） */
export interface DeviceInfo {
  /** 厂商（整机品牌），如 “LENOVO”，OEM 判定会复用此字段 */
  manufacturer: string
  /** 机型型号 */
  model: string
  /** CPU 名称，如 “13th Gen Intel(R) Core(TM) i7-13700H” */
  cpuName: string
  /** 物理核心数 */
  cpuCores: number
  /** 逻辑线程数 */
  cpuThreads: number
  /** 内存总量（字节） */
  memoryTotalBytes: number
  /** 内存插槽数量 */
  memorySlots: number
  /** 主板型号 */
  motherboard: string
  /** 磁盘列表 */
  disks: DiskInfo[]
}
