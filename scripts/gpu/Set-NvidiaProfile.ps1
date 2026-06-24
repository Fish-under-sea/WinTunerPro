# Set-NvidiaProfile.ps1
# 精确写入 NVIDIA 控制面板竞技预设（对应用户截图的四项设置）
#
# 设置项：
#   image-quality  → 图像设置：使用我的优先选择，侧重性能（图一）
#   opengl-gpu     → OpenGL 渲染 GPU：独立显卡（图二）
#   power-mode     → 电源管理模式：最高性能优先（图三）
#   refresh-rate   → 首选刷新率：最高可用（图三）
#
# 注册表说明（本仓库首次引入，无先例脚本可对照）：
#   HKCU:\Software\NVIDIA Corporation\Global\NVTweak
#   HKCU:\Software\NVIDIA Corporation\Global\OpenGL
#   HKLM:\...\nvlddmkm\Global\Manage3DSettings\0x10057d2 — NVAPI PREFERRED_PSTATE，需上机验证
#
# 参数：
#   -Items  逗号分隔的配置项白名单，默认全部执行
#
# 输出（经 Invoke-WtScript 包装为 { ok, data }）：
#   { success, appliedItems[], skippedItems[], warnings[],
#     requiresDriverRestart, message }

param(
  [string]$Items = 'image-quality,opengl-gpu,power-mode,refresh-rate'
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

function Ensure-RegPath { param([string]$Path)
  if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null } }

function Set-NvReg { param([string]$Path,[string]$Name,$Value,[string]$Type='DWord')
  Ensure-RegPath -Path $Path
  Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type }

function Get-NvDgpuPnp {
  foreach ($c in @(Get-WtCimInstance -ClassName 'Win32_VideoController')) {
    $n=[string]$c.Name; $p=[string]$c.PNPDeviceID
    if (($n -match 'NVIDIA' -or $p -match 'VEN_10DE') -and $n -notmatch 'Intel') {
      return [string]$c.PNPDeviceID } }
  return $null }

function Test-NvidiaPresent {
  foreach ($c in @(Get-WtCimInstance -ClassName 'Win32_VideoController')) {
    if ([string]$c.Name -match 'NVIDIA' -or [string]$c.PNPDeviceID -match 'VEN_10DE') {
      return $true } }
  return $false }

Invoke-WtScript -ErrorCode 'E_NV_PROFILE' -Body {
  if (-not (Test-NvidiaPresent)) {
    return [ordered]@{ success=$false; appliedItems=@(); skippedItems=@('全部（未检测到 NVIDIA 显卡）');
      warnings=@(); requiresDriverRestart=$false; message='未检测到 NVIDIA 显卡，已跳过' } }

  $req      = @($Items.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $applied  = [System.Collections.Generic.List[string]]::new()
  $skipped  = [System.Collections.Generic.List[string]]::new()
  $warnings = [System.Collections.Generic.List[string]]::new()
  $needRestart = $false

  $hklmNv   = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'
  $hkcuNv   = 'HKCU:\Software\NVIDIA Corporation\Global\NVTweak'
  $hkcuGL   = 'HKCU:\Software\NVIDIA Corporation\Global\OpenGL'
  $nvBase   = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\Manage3DSettings'
  $wtKey    = 'HKCU:\Software\WinTunerPro\Gpu\NvidiaProfile'

  Ensure-RegPath $wtKey
  try { Backup-RegistryKey -KeyPath 'HKCU\Software\WinTunerPro\Gpu\NvidiaProfile' | Out-Null
  } catch { $warnings.Add("状态键备份失败（首次写入正常）：$($_.Exception.Message)") }

  # ── 图一：图像设置 → 使用我的优先选择，侧重性能 ──
  if ($req -contains 'image-quality') {
    try {
      Set-NvReg $hkcuNv 'ImageSettingsMode'  2   # 2 = 使用我的优先选择
      Set-NvReg $hkcuNv 'ImageSettingsValue' 0   # 0 = 完全性能端
      Set-ItemProperty $wtKey -Name 'ImageQuality' -Value 'performance' -Type String
      $applied.Add('image-quality：图像设置 → 性能优先')
    } catch { $skipped.Add("image-quality（$($_.Exception.Message)）") }
  }

  # ── 图二：OpenGL 渲染 GPU → 独立显卡 ──
  if ($req -contains 'opengl-gpu') {
    try {
      $pnp = Get-NvDgpuPnp
      if (-not $pnp) { $skipped.Add('opengl-gpu（未找到独立 NVIDIA 显卡 PNP ID）') }
      else {
        Set-NvReg $hkcuGL 'Gpu'            $pnp 'String'
        Set-NvReg $hkcuNv 'OpenGLDeviceId' $pnp 'String'
        Set-ItemProperty $wtKey -Name 'OpenGLGpu' -Value $pnp -Type String
        $applied.Add("opengl-gpu：OpenGL 渲染 GPU → $pnp")
      }
    } catch { $skipped.Add("opengl-gpu（$($_.Exception.Message)）") }
  }

  # ── 图三：电源管理模式 → 最高性能优先 ──
  if ($req -contains 'power-mode') {
    try {
      Set-NvReg $hklmNv  'PowerMizerEnable'  1
      Set-NvReg $hklmNv  'PowerMizerLevel'   1   # 1 = 最高性能
      Set-NvReg $hklmNv  'PowerMizerLevelAC' 1
      # 0x10057d2 = NVAPI PREFERRED_PSTATE_P0（需上机验证是否与本机驱动一致）
      Set-NvReg $nvBase  '0x10057d2'          1
      $smi = Get-Command 'nvidia-smi.exe' -EA SilentlyContinue
      if ($smi) { & $smi.Source -pm 1 2>&1 | Out-Null }
      else { $warnings.Add('nvidia-smi 不可用，电源模式仅注册表写入，重启驱动后生效') }
      Set-ItemProperty $wtKey -Name 'PowerMode' -Value 'max-performance' -Type String
      $needRestart = $true
      $applied.Add('power-mode：电源管理模式 → 最高性能优先')
    } catch { $skipped.Add("power-mode（$($_.Exception.Message)）") }
  }

  # ── 图三：首选刷新率 → 最高可用 ──
  if ($req -contains 'refresh-rate') {
    try {
      Set-NvReg $hkcuNv 'PreferredRefreshRate' 1  # 1 = 最高可用
      Set-NvReg $hkcuNv 'DisplayRefreshRate'   1
      Set-ItemProperty $wtKey -Name 'RefreshRate' -Value 'highest' -Type String
      $applied.Add('refresh-rate：首选刷新率 → 最高可用')
    } catch { $skipped.Add("refresh-rate（$($_.Exception.Message)）") }
  }

  Set-ItemProperty $wtKey -Name 'LastAppliedAt' -Value ((Get-Date).ToString('s')) -Type String

  $ok  = $skipped.Count -eq 0
  $msg = if ($ok) { "NVIDIA 竞技预设写入完成（$($applied.Count) 项）" }
         else     { "$($applied.Count) 项成功，$($skipped.Count) 项跳过" }

  [ordered]@{
    success               = $ok
    appliedItems          = @($applied.ToArray())
    skippedItems          = @($skipped.ToArray())
    warnings              = @($warnings.ToArray())
    requiresDriverRestart = [bool]$needRestart
    message               = $msg
  }
}
