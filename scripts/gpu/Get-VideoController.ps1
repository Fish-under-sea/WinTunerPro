# 检测显卡（只读）
#
# 数据来源：Win32_VideoController（Name/AdapterRAM/DriverVersion/PNPDeviceID）
#   + 注册表 Class\{4d36e968...} 的 HardwareInformation.qwMemorySize（显存）
#
# 厂商判定：优先 PNPDeviceID 中的 VEN_ id（NVIDIA=10DE / AMD=1002 / Intel=8086），
#          兜底用名称关键字。
# 显存：AdapterRAM 为 32 位（>4GB 会溢出/封顶 4095MB），故优先读注册表 qwMemorySize。
# 输出结构对应 src/shared/types/gpu.ts 的 GpuDetectResult。

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_GPU' -Body {

  function Get-WtGpuVendor {
    param([string]$Pnp, [string]$Name)
    if ($Pnp -match 'VEN_10DE') { return 'NVIDIA' }
    if ($Pnp -match 'VEN_1002') { return 'AMD' }
    if ($Pnp -match 'VEN_8086') { return 'Intel' }
    # 兜底按名称关键字
    if ($Name -match 'NVIDIA|GeForce|RTX|GTX|Quadro|Tesla') { return 'NVIDIA' }
    if ($Name -match 'AMD|Radeon|FirePro|Vega') { return 'AMD' }
    if ($Name -match 'Intel|UHD|Iris|HD Graphics') { return 'Intel' }
    return 'Unknown'
  }

  # 读取各显卡注册表 qwMemorySize，按 DriverDesc（一般等于显卡名）建表，规避 AdapterRAM 溢出。
  # 坑：直接 Get-ChildItem 枚举 Class 根键会因其下存在受保护子键（即便非管理员也会触发）
  #     而整体抛 “Requested registry access is not allowed”，导致全部显存读取失效、回退到被
  #     封顶的 AdapterRAM（4095MB）。故改为按 0000.. 固定索引逐个直读，单个子键失败不影响其余，
  #     非管理员环境亦能正确取到 qwMemorySize。
  $regVram = @{}
  $base = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
  foreach ($i in 0..31) {
    $sub = Join-Path $base ('{0:D4}' -f $i)
    if (-not (Test-Path $sub)) { continue }
    try {
      $p = Get-ItemProperty -Path $sub -ErrorAction Stop
      $qw = $p.'HardwareInformation.qwMemorySize'
      $desc = "$($p.DriverDesc)".Trim()
      if ($desc -and $qw) { $regVram[$desc] = [int64]$qw }
    } catch {
      Write-WtLog -Level WARN -Message "读取显存注册表子键 $sub 失败：$($_.Exception.Message)"
    }
  }

  $gpus = @()
  foreach ($v in (Get-WtCimInstance -ClassName Win32_VideoController)) {
    $name = "$($v.Name)".Trim()
    $vendor = Get-WtGpuVendor -Pnp "$($v.PNPDeviceID)" -Name $name

    # 核显判定：Intel 显卡或 AMD APU 集显常见型号关键字
    $isIntegrated = ($vendor -eq 'Intel') -or `
      ($name -match 'UHD|Iris|HD Graphics' ) -or `
      ($name -match 'Radeon\(TM\) Graphics|Radeon Graphics|Vega \d|[0-9]{3}M\b')

    # 显存：优先注册表（防溢出），回退 AdapterRAM
    $vramBytes = [int64]0
    if ($regVram.ContainsKey($name)) {
      $vramBytes = $regVram[$name]
    } elseif ($v.AdapterRAM) {
      $vramBytes = [int64]$v.AdapterRAM
    }
    $vramMB = if ($vramBytes -gt 0) { [int]([math]::Round($vramBytes / 1MB)) } else { 0 }

    $gpus += [ordered]@{
      name          = $name
      vendor        = $vendor
      vramMB        = $vramMB
      driverVersion = "$($v.DriverVersion)".Trim()
      isIntegrated  = [bool]$isIntegrated
    }
  }

  # primaryVendor：独显优先（非核显且为 NVIDIA/AMD），否则取首块显卡厂商
  $primary = 'Unknown'
  $discrete = @($gpus | Where-Object { (-not $_.isIntegrated) -and ($_.vendor -eq 'NVIDIA' -or $_.vendor -eq 'AMD') })
  if ($discrete.Count -gt 0) {
    $primary = $discrete[0].vendor
  } elseif (@($gpus).Count -gt 0) {
    $primary = $gpus[0].vendor
  }

  [ordered]@{
    gpus          = @($gpus)
    primaryVendor = $primary
  }
}
