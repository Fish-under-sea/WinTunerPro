/**
 * reinstall 模块共享类型——系统重装/镜像来源/机器码（数据契约）。
 *
 * 对应手段：
 *   - 内置镜像：随包离线 ISO（LTSC），扫描 resources 目录得到来源列表。
 *   - 自定义 ISO：用户导入，需校验可启动性（DISM /Get-ImageInfo 解析）。
 *   - 机器码：注册表 MachineGuid（HKLM\SOFTWARE\Microsoft\Cryptography）+ 机器 SID，仅读取展示。
 * 重装链路属高危写系统操作，桩阶段不实现，由功能代理实现并保证可重入/可中断恢复。
 */

/** 系统镜像来源类型 */
export type SystemImageKind = 'prebuilt-win10-ltsc' | 'prebuilt-win11-ltsc' | 'custom-iso'

/** 可选的系统镜像来源（`reinstall:list-sources` 返回列表项） */
export interface SystemImageSource {
  /** 来源唯一 id */
  id: string
  /** 来源类型 */
  kind: SystemImageKind
  /** 展示名，如 “Windows 11 LTSC 2024（内置）” */
  displayName: string
  /** 是否就绪可用（内置镜像是否已落地、自定义 ISO 是否校验通过） */
  available: boolean
  /** 镜像文件路径（自定义 ISO 必有；内置镜像可选） */
  path?: string
  /** 镜像文件大小（字节） */
  sizeBytes: number
  /** 版本信息，如 “LTSC 2021” / “23H2” */
  version: string
}

/** 自定义 ISO 校验结果（`reinstall:import-iso` 返回结构） */
export interface IsoValidationResult {
  /** 是否为合法可启动的 Windows 镜像 */
  valid: boolean
  /** 解析出的可启动版本信息（valid=true 时有值） */
  bootableVersion?: string
  /** 错误信息（valid=false 时有值，用「人话」描述失败原因） */
  errorMessage?: string
}

/**
 * 系统重装部署进度事件（main→renderer 单向推送，`reinstall:deploy-progress`）。
 * 注意：本期为「演示流程」，不执行任何真实破坏性系统操作（见 reinstallService.startDeploy）。
 */
export interface ReinstallProgress {
  /** 百分比 0–100 */
  percent: number
  /** 当前阶段文案（人话，直接展示） */
  stage: string
  /** 是否已结束（演示流程到约 95% 即以 done 收尾） */
  done?: boolean
  /** 失败时的错误信息（done=true 且失败时有值） */
  error?: string
}

/** 机器码信息（`reinstall:get-machine-id` 返回结构，仅读取展示） */
export interface MachineIdInfo {
  /** 当前机器 SID（仅读取展示） */
  machineSid: string
  /** 注册表 MachineGuid（仅读取展示） */
  machineGuid: string
}
