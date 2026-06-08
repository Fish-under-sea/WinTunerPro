# WinTuner Pro —— 应用静态壁纸为系统桌面壁纸（写操作，零后台驻留）
#
# 通过 user32!SystemParametersInfo(SPI_SETDESKWALLPAPER) 即时生效并持久化，
# 同时写入 HKCU\Control Panel\Desktop 的 Wallpaper/WallpaperStyle/TileWallpaper
# 以保证重启后仍生效。这是系统原生设置，不引入任何常驻进程。
# 写注册表前先 reg export 备份桌面键，便于一键还原。

param(
  [Parameter(Mandatory)][string]$Path,
  [ValidateSet('fill', 'fit', 'stretch', 'tile', 'center', 'span')][string]$Style = 'fill',
  [Parameter(Mandatory)][string]$BackupDir
)

. (Join-Path $PSScriptRoot '_WallpaperCommon.ps1')

try {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-WtResult -Ok $false -Code 'ERR_FILE_NOT_FOUND' -Message "壁纸文件不存在：$Path"
    exit 1
  }

  # 写系统前备份桌面注册表键
  $backup = Backup-RegistryKeyToFile -RegPath 'HKCU\Control Panel\Desktop' -BackupDir $BackupDir -Tag 'desktop-wallpaper'

  # WallpaperStyle / TileWallpaper 取值映射（Windows 桌面壁纸适配方式）：
  #   fill=10/0  fit=6/0  stretch=2/0  tile=0/1  center=0/0  span=22/0
  $map = @{
    fill    = @('10', '0')
    fit     = @('6', '0')
    stretch = @('2', '0')
    tile    = @('0', '1')
    center  = @('0', '0')
    span    = @('22', '0')
  }
  $ws = $map[$Style][0]
  $tw = $map[$Style][1]
  Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value $ws
  Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name TileWallpaper -Value $tw
  Set-ItemProperty 'HKCU:\Control Panel\Desktop' -Name Wallpaper -Value $Path

  # P/Invoke SystemParametersInfo 让壁纸立即刷新并写入用户配置
  if (-not ([System.Management.Automation.PSTypeName]'WinTuner.WallpaperNative').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
namespace WinTuner {
  public class WallpaperNative {
    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
    // SPI_SETDESKWALLPAPER = 20; SPIF_UPDATEINIFILE = 1; SPIF_SENDWININICHANGE = 2
    public static bool Set(string path) {
      return SystemParametersInfo(20, 0, path, 1 | 2) != 0;
    }
  }
}
"@
  }

  $applied = [WinTuner.WallpaperNative]::Set($Path)
  if (-not $applied) { throw 'SystemParametersInfo 调用失败' }

  Write-WtResult -Ok $true -Data ([ordered]@{
      applied = $true
      path    = $Path
      style   = $Style
      backup  = $backup
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_SET_WALLPAPER' -Message $_.Exception.Message
  exit 1
}
