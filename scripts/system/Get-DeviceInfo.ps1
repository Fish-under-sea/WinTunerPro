# 获取设备硬件信息（只读）
#
# 数据来源：
#   Win32_ComputerSystem（Manufacturer/Model）
#   Win32_Processor（Name/NumberOfCores/NumberOfLogicalProcessors，多路 CPU 求和）
#   Win32_PhysicalMemory（Capacity 求和为总量）+ Win32_PhysicalMemoryArray（总插槽数）
#   Win32_BaseBoard（主板型号）
#   Win32_DiskDrive（磁盘型号/容量）+ MSFT_PhysicalDisk.MediaType（判 SSD/HDD）
# 输出结构对应 src/shared/types/hardware.ts 的 DeviceInfo。

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_HARDWARE' -Body {
  $cs = Get-WtCimInstance -ClassName Win32_ComputerSystem

  $cpus = @(Get-WtCimInstance -ClassName Win32_Processor)
  $cpu0 = $cpus[0]
  $cores = (@($cpus) | Measure-Object -Property NumberOfCores -Sum).Sum
  $threads = (@($cpus) | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum

  $mem = @(Get-WtCimInstance -ClassName Win32_PhysicalMemory)
  $memTotal = (@($mem) | Measure-Object -Property Capacity -Sum).Sum

  # 插槽数：优先内存阵列声明的总插槽（含空槽），回退已插内存条数
  $slots = 0
  try {
    $slots = (@(Get-WtCimInstance -ClassName Win32_PhysicalMemoryArray) | Measure-Object -Property MemoryDevices -Sum).Sum
  } catch { Write-WtLog -Level WARN -Message "读取内存插槽数失败：$($_.Exception.Message)" }
  if (-not $slots -or $slots -le 0) { $slots = @($mem).Count }

  $board = Get-WtCimInstance -ClassName Win32_BaseBoard

  # 磁盘介质类型：优先 MSFT_PhysicalDisk.MediaType（3=HDD,4=SSD），回退按型号关键字猜测
  $mediaMap = @{}
  try {
    foreach ($pd in (Get-CimInstance -Namespace 'root/Microsoft/Windows/Storage' -ClassName MSFT_PhysicalDisk -ErrorAction Stop)) {
      $mediaMap["$($pd.DeviceId)"] = [int]$pd.MediaType
    }
  } catch {
    Write-WtLog -Level WARN -Message "MSFT_PhysicalDisk 查询失败，改用型号关键字判定：$($_.Exception.Message)"
  }

  $disks = @()
  foreach ($d in (Get-WtCimInstance -ClassName Win32_DiskDrive)) {
    $type = 'Unknown'
    $mt = $mediaMap["$($d.Index)"]
    if ($mt -eq 4) { $type = 'SSD' }
    elseif ($mt -eq 3) { $type = 'HDD' }
    elseif ("$($d.Model)" -match 'SSD|NVMe|Solid\s*State') { $type = 'SSD' }

    $disks += [ordered]@{
      model     = if ("$($d.Model)".Trim()) { "$($d.Model)".Trim() } else { '未知磁盘' }
      sizeBytes = [long]($d.Size)
      type      = $type
    }
  }

  [ordered]@{
    manufacturer     = "$($cs.Manufacturer)".Trim()
    model            = "$($cs.Model)".Trim()
    cpuName          = "$($cpu0.Name)".Trim()
    cpuCores         = [int]$cores
    cpuThreads       = [int]$threads
    memoryTotalBytes = [long]$memTotal
    memorySlots      = [int]$slots
    motherboard      = if ("$($board.Product)".Trim()) { "$($board.Product)".Trim() } else { '未知主板' }
    disks            = @($disks)
  }
}
