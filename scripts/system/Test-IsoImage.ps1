# 校验自定义 ISO 是否为可启动的 Windows 安装镜像（只读，非破坏）
#
# 流程：
#   1. 校验路径存在且为 .iso 文件；
#   2. 以只读方式挂载 ISO（Mount-DiskImage），取得盘符；
#   3. 检查启动文件（bootmgr / efi\boot\bootx64.efi）与安装映像（sources\install.wim|esd）；
#   4. 用 Get-WindowsImage 解析映像版本名（失败不致命，给通用标签）；
#   5. 无论成败都在 finally 卸载 ISO（Dismount-DiskImage）。
# 注意：挂载/卸载属临时只读操作，不写入系统盘；校验失败以 data.valid=false 正常返回（非抛错）。

param(
  [Parameter(Mandatory = $true)][string]$Path
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_REINSTALL' -Body {
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return [ordered]@{ valid = $false; bootableVersion = ''; errorMessage = '文件不存在或不可访问' }
  }
  if ([System.IO.Path]::GetExtension($Path).ToLower() -ne '.iso') {
    return [ordered]@{ valid = $false; bootableVersion = ''; errorMessage = '仅支持 .iso 镜像文件' }
  }

  $mounted = $null
  try {
    try {
      $mounted = Mount-DiskImage -ImagePath $Path -StorageType ISO -Access ReadOnly -PassThru -ErrorAction Stop
    } catch {
      return [ordered]@{ valid = $false; bootableVersion = ''; errorMessage = "挂载镜像失败：$($_.Exception.Message)" }
    }

    $vol = $mounted | Get-Volume -ErrorAction SilentlyContinue
    $driveLetter = ($vol | Where-Object { $_.DriveLetter } | Select-Object -First 1).DriveLetter
    if (-not $driveLetter) {
      return [ordered]@{ valid = $false; bootableVersion = ''; errorMessage = '挂载后未取得盘符，镜像可能损坏' }
    }
    $root = "${driveLetter}:\"

    # 启动文件：BIOS 引导 bootmgr 或 UEFI 引导 efi\boot\bootx64.efi 任一存在即视为可启动
    $hasBios = Test-Path -LiteralPath (Join-Path $root 'bootmgr')
    $hasUefi = Test-Path -LiteralPath (Join-Path $root 'efi\boot\bootx64.efi')
    $bootable = $hasBios -or $hasUefi

    # 安装映像：sources\install.wim 或 install.esd
    $installWim = Join-Path $root 'sources\install.wim'
    $installEsd = Join-Path $root 'sources\install.esd'
    $imagePath = if (Test-Path -LiteralPath $installWim) { $installWim }
                 elseif (Test-Path -LiteralPath $installEsd) { $installEsd }
                 else { '' }

    if (-not $bootable -or [string]::IsNullOrWhiteSpace($imagePath)) {
      $reason = if (-not $bootable) { '未发现可启动引导文件' } else { '未发现 Windows 安装映像（sources\install.wim/esd）' }
      return [ordered]@{ valid = $false; bootableVersion = ''; errorMessage = "$reason，可能不是标准 Windows 安装镜像" }
    }

    # 解析版本名（失败给通用标签，不影响 valid）
    $version = 'Windows 安装镜像'
    try {
      $img = Get-WindowsImage -ImagePath $imagePath -ErrorAction Stop | Select-Object -First 1
      if ($img -and $img.ImageName) {
        $version = [string]$img.ImageName
      }
    } catch {
      Write-WtLog -Level WARN -Message "解析映像版本失败：$($_.Exception.Message)"
    }

    return [ordered]@{ valid = $true; bootableVersion = $version; errorMessage = '' }
  }
  finally {
    if ($mounted) {
      try { Dismount-DiskImage -ImagePath $Path -ErrorAction SilentlyContinue | Out-Null } catch { }
    }
  }
}
