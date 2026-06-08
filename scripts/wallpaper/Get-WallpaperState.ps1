# WinTuner Pro —— 列出可选静态壁纸 + 当前壁纸（只读）
#
# 扫描传入的若干目录（递归）收集图片文件，生成壁纸列表项；
# 同时读取当前系统壁纸路径（HKCU\Control Panel\Desktop\Wallpaper）。
# 无资源目录时返回空列表，而非报错。

param(
  # 以 | 分隔的待扫描目录列表（| 在 Windows 路径中非法，可安全作分隔符，规避含空格路径的数组绑定歧义）
  [string]$Dirs = '',
  # 主进程记录的当前壁纸 id（来自应用配置），原样回传供前端高亮
  [string]$CurrentId = ''
)

. (Join-Path $PSScriptRoot '_WallpaperCommon.ps1')

try {
  $items = @()
  $exts = @('.jpg', '.jpeg', '.png', '.bmp', '.gif')

  $dirList = if ([string]::IsNullOrWhiteSpace($Dirs)) { @() } else { $Dirs -split '\|' }
  foreach ($d in $dirList) {
    if ([string]::IsNullOrWhiteSpace($d)) { continue }
    if (-not (Test-Path -LiteralPath $d)) { continue }
    Get-ChildItem -LiteralPath $d -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $exts -contains $_.Extension.ToLower() } |
      ForEach-Object {
        $items += [ordered]@{
          # id 以 static: 前缀 + 绝对路径，主进程据此做白名单与存在性校验
          id        = 'static:' + $_.FullName
          name      = $_.BaseName
          thumbnail = $_.FullName
          type      = 'static'
          source    = $_.FullName
        }
      }
  }

  $currentPath = ''
  try {
    $currentPath = (Get-ItemProperty 'HKCU:\Control Panel\Desktop' -Name Wallpaper -ErrorAction Stop).Wallpaper
  }
  catch {
    # 注册表无该值时保持空字符串
  }

  Write-WtResult -Ok $true -Data ([ordered]@{
      currentWallpaperId   = $CurrentId
      currentWallpaperPath = $currentPath
      # @() 包裹尽量保证为数组；主进程侧仍会对单元素情况做归一化
      items                = @($items)
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_LIST_WALLPAPER' -Message $_.Exception.Message
  exit 1
}
