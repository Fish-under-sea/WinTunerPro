# 应用 NVIDIA 基础预设（安全白名单）。
#
# 说明：
# - 仅在检测到 NVIDIA 主显卡时执行；非 NVIDIA 场景返回可读结果，不抛异常。
# - 写操作前尝试备份 WinTunerPro 自有注册表键，避免污染厂商未知键位。
# - NVIDIA 指令仅通过 nvidia-smi 白名单下发（不存在或不支持时给告警，不崩溃）。

param(
  [ValidateSet('competitive', 'balanced', 'power-saving')][string]$PresetId
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_GPU_APPLY' -Body {
  $warnings = New-Object System.Collections.Generic.List[string]

  $cards = @(Get-WtCimInstance -ClassName 'Win32_VideoController')
  $isNvidia = $false
  foreach ($card in $cards) {
    $name = [string]$card.Name
    $pnp = [string]$card.PNPDeviceID
    if ($name -match 'NVIDIA' -or $pnp -match 'VEN_10DE') {
      $isNvidia = $true
      break
    }
  }

  if (-not $isNvidia) {
    return [ordered]@{
      success   = $false
      vendor    = 'Unknown'
      presetId  = $PresetId
      applied   = $false
      warnings  = @('未检测到 NVIDIA 显卡，已跳过预设应用')
      message   = '当前设备不支持 NVIDIA 预设'
      backupPath = $null
    }
  }

  $appRegPath = 'HKCU:\Software\WinTunerPro\Gpu'
  $backupPath = $null
  if (Test-Path $appRegPath) {
    $backupPath = Backup-RegistryKey -KeyPath 'HKCU\Software\WinTunerPro\Gpu'
  } else {
    $warnings.Add('首次写入预设状态，无历史注册表快照可备份')
  }

  if (-not (Test-Path $appRegPath)) {
    New-Item -Path $appRegPath -Force | Out-Null
  }
  Set-ItemProperty -Path $appRegPath -Name 'NvidiaPreset' -Value $PresetId -Type String
  Set-ItemProperty -Path $appRegPath -Name 'LastAppliedAt' -Value ((Get-Date).ToString('s')) -Type String

  $smi = Get-Command 'nvidia-smi.exe' -ErrorAction SilentlyContinue
  if (-not $smi) {
    $warnings.Add('未找到 nvidia-smi，已仅记录预设状态（驱动控制台参数未下发）')
  } else {
    $pm = if ($PresetId -eq 'competitive') { '1' } else { '0' }
    $raw = & $smi.Source -pm $pm 2>&1
    if ($LASTEXITCODE -ne 0) {
      $warnings.Add("nvidia-smi 设置持久模式失败：$([string]($raw -join ' '))")
    }
    if ($PresetId -eq 'power-saving') {
      $warnings.Add('省电档位主要通过关闭持久模式实现，实际功耗受驱动与机型限制')
    }
  }

  [ordered]@{
    success    = $true
    vendor     = 'NVIDIA'
    presetId   = $PresetId
    applied    = $true
    backupPath = $backupPath
    warnings   = @($warnings.ToArray())
    message    = 'NVIDIA 基础预设已执行'
  }
}
