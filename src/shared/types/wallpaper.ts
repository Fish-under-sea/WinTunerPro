/**
 * wallpaper 模块共享类型——壁纸（静态 + Wallpaper Engine 动态）（数据契约）。
 *
 * 对应手段：
 *   - 静态壁纸：SystemParametersInfo(SPI_SETDESKWALLPAPER) 或注册表 + RUNDLL，扫描随包/用户图片目录。
 *   - 动态壁纸：检测是否安装 Wallpaper Engine（Steam appid 431960，扫描 Steam 库），未装则引导安装。
 * 设置壁纸属写系统操作，桩阶段抛“未实现”，由功能代理实现。
 */

/** 壁纸类型 */
export type WallpaperType = 'static' | 'dynamic'

/** 单个壁纸项（`wallpaper:list` 返回列表项） */
export interface WallpaperItem {
  /** 壁纸唯一 id */
  id: string
  /** 壁纸名称 */
  name: string
  /** 缩略图（资源路径或 data URI） */
  thumbnail: string
  /** 壁纸类型 */
  type: WallpaperType
  /** 壁纸资源：静态为图片文件路径；动态为 Wallpaper Engine 创意工坊项标识 */
  source: string
}

/** Wallpaper Engine 检测状态（`wallpaper:detect-engine` 返回结构） */
export interface WallpaperEngineStatus {
  /** 是否已安装 Wallpaper Engine */
  installed: boolean
  /** 是否通过 Steam 库检测到 */
  detectedViaSteam: boolean
  /** Steam AppId（Wallpaper Engine 为 431960），供引导安装时使用 */
  steamAppId?: string
}

/** 壁纸整体状态（`wallpaper:list` 返回结构） */
export interface WallpaperState {
  /** 当前应用的壁纸 id，未知为 null */
  currentWallpaperId: string | null
  /** 可选壁纸列表（静态 + 动态混合） */
  items: WallpaperItem[]
}
