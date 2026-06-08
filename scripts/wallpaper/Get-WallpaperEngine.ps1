# WinTuner Pro —— 检测 Wallpaper Engine 是否已安装（只读）
#
# 动态壁纸方案走 Steam 的 Wallpaper Engine（appid 431960），不自行实现常驻渲染。
# 检测思路：
#   1. 从注册表定位 Steam 安装路径（HKCU\Software\Valve\Steam\SteamPath 优先，
#      回退 HKLM\SOFTWARE\WOW6432Node\Valve\Steam\InstallPath）。
#   2. 解析 steamapps\libraryfolders.vdf 得到所有 Steam 库目录。
#   3. 逐库检查 steamapps\appmanifest_431960.acf 是否存在；存在即已安装，
#      并从 installdir 推导安装目录作为佐证。
# 额外回传 steamInstalled/steamPath 供主进程决定引导安装方式（这些字段不进入
# 渲染进程的 WallpaperEngineStatus 类型，仅供主进程内部使用）。

param(
  [string]$AppId = '431960'
)

. (Join-Path $PSScriptRoot '_WallpaperCommon.ps1')

try {
  $steamPath = $null
  try {
    $steamPath = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -Name SteamPath -ErrorAction Stop).SteamPath
  }
  catch {
    # 忽略，下面回退 HKLM
  }
  if ([string]::IsNullOrWhiteSpace($steamPath)) {
    try {
      $steamPath = (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam' -Name InstallPath -ErrorAction Stop).InstallPath
    }
    catch {
      # 忽略
    }
  }

  $steamInstalled = (-not [string]::IsNullOrWhiteSpace($steamPath)) -and (Test-Path -LiteralPath $steamPath)

  $libraries = @()
  if ($steamInstalled) {
    $libraries += $steamPath
    $vdf = Join-Path $steamPath 'steamapps\libraryfolders.vdf'
    if (Test-Path -LiteralPath $vdf) {
      $content = Get-Content -LiteralPath $vdf -Raw
      # libraryfolders.vdf 里每个库形如：  "path"   "X:\\SteamLibrary"
      foreach ($m in [regex]::Matches($content, '"path"\s*"([^"]+)"')) {
        $p = $m.Groups[1].Value -replace '\\\\', '\'
        if (-not [string]::IsNullOrWhiteSpace($p)) { $libraries += $p }
      }
    }
  }
  $libraries = $libraries | Select-Object -Unique

  $installed = $false
  $installDir = ''
  foreach ($lib in $libraries) {
    $acf = Join-Path $lib ("steamapps\appmanifest_{0}.acf" -f $AppId)
    if (Test-Path -LiteralPath $acf) {
      $installed = $true
      try {
        $acfContent = Get-Content -LiteralPath $acf -Raw
        $dm = [regex]::Match($acfContent, '"installdir"\s*"([^"]+)"')
        if ($dm.Success) {
          $candidate = Join-Path $lib ("steamapps\common\{0}" -f $dm.Groups[1].Value)
          if (Test-Path -LiteralPath $candidate) { $installDir = $candidate }
        }
      }
      catch {
        # installdir 解析失败不影响 installed 判定
      }
      break
    }
  }

  $steamPathOut = if ($steamInstalled) { $steamPath } else { '' }

  Write-WtResult -Ok $true -Data ([ordered]@{
      installed        = $installed
      detectedViaSteam = $installed
      steamAppId       = $AppId
      steamInstalled   = $steamInstalled
      steamPath        = $steamPathOut
      installDir       = $installDir
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_DETECT_ENGINE' -Message $_.Exception.Message
  exit 1
}
