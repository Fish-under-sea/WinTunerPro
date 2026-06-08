/**
 * power 模块共享类型——电源计划（数据契约）。
 *
 * 对应手段：powercfg（/list 列出计划、/getactivescheme 当前计划、/setactive 切换、
 * /duplicatescheme 复制卓越性能计划）。写电源前需先备份（见 scripts/common）。
 */

/** 单个电源计划 */
export interface PowerPlan {
  /** 计划 GUID */
  guid: string
  /** 计划名称，如 “平衡” / “高性能” / “卓越性能” */
  name: string
  /** 是否为当前激活计划 */
  isActive: boolean
}

/** 电源状态（`power:get-state` 返回结构） */
export interface PowerState {
  /** 全部电源计划 */
  plans: PowerPlan[]
  /** 当前激活计划的 GUID */
  activeGuid: string
  /**
   * 是否允许修改电源计划。
   * 某些场景（如组策略锁定、OEM 限制）下不可改，前端据此禁用切换入口。
   */
  canModify: boolean
}
