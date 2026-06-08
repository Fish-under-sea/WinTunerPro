# 获取操作系统信息（只读）
#
# 数据来源：Win32_OperatingSystem（Caption/Version/BuildNumber）
#   + 注册表 CurrentVersion（UBR 修订号、DisplayVersion 如 23H2）
#   + SoftwareLicensingProduct（激活状态，仅展示）
# 输出结构对应 src/shared/types/hardware.ts 的 SystemInfo。

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_HARDWARE' -Body {
  $os = Get-WtCimInstance -ClassName Win32_OperatingSystem

  $cvKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'

  # 内部版本号：BuildNumber + UBR（修订号），拼成 22631.4317 形态
  $ubr = $null
  try { $ubr = (Get-ItemProperty $cvKey -Name UBR -ErrorAction Stop).UBR } catch { Write-WtLog -Level WARN -Message "读取 UBR 失败：$($_.Exception.Message)" }
  $build = if ($ubr) { "$($os.BuildNumber).$ubr" } else { "$($os.BuildNumber)" }

  # 版本号：DisplayVersion(23H2) 优先，回退 ReleaseId，再回退 OS Version
  $display = $null
  try { $display = (Get-ItemProperty $cvKey -Name DisplayVersion -ErrorAction Stop).DisplayVersion } catch {}
  if (-not $display) { try { $display = (Get-ItemProperty $cvKey -Name ReleaseId -ErrorAction Stop).ReleaseId } catch {} }
  if (-not $display) { $display = "$($os.Version)" }

  # edition：去掉 Caption 里的 “Microsoft ” 前缀作为展示用 edition
  $edition = ("$($os.Caption)" -replace '^Microsoft\s+', '').Trim()

  # 激活状态：Windows 操作系统授权产品 ApplicationID 固定，LicenseStatus=1 为已激活
  $activated = $false
  try {
    $appId = '55c92734-d682-4d71-983e-d6ec3f16059f'
    $lic = Get-CimInstance -ClassName SoftwareLicensingProduct -Filter "ApplicationID='$appId' AND PartialProductKey IS NOT NULL" -ErrorAction Stop
    if ($lic) {
      $activated = (@($lic | Where-Object { $_.LicenseStatus -eq 1 }).Count) -gt 0
    }
  } catch {
    Write-WtLog -Level WARN -Message "激活状态查询失败（不影响功能）：$($_.Exception.Message)"
  }

  [ordered]@{
    osName      = "$($os.Caption)".Trim()
    osVersion   = "$display"
    buildNumber = "$build"
    edition     = $edition
    activated   = [bool]$activated
  }
}
