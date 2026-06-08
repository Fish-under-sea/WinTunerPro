# 检测机箱类型与 OEM 原始信息（只读）
#
# 数据来源：
#   Win32_SystemEnclosure.ChassisTypes（8/9/10/14 等为笔记本类）
#   Win32_Battery（存在电池辅助判定笔记本）
#   Win32_ComputerSystem（Manufacturer/SystemFamily/Model，供主进程做品牌归一化）
#
# 设计：品牌归一化到 OemBrand 枚举、supportsPerformanceMode 判定与 fallbackNote
#      均在主进程 oemService.ts 完成（复用 src/shared/types/oem.ts 的
#      OEM_BRAND_DISPLAY_NAMES / PERFORMANCE_MODE_BRANDS，避免在 PS/TS 两处重复维护）。
#      本脚本只负责把判定所需的原始事实采全。

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_OEM' -Body {
  $cs = Get-WtCimInstance -ClassName Win32_ComputerSystem
  $enc = @(Get-WtCimInstance -ClassName Win32_SystemEnclosure)

  # 汇总所有机箱记录的 ChassisTypes（可能多条/多值）
  $chassisTypes = @()
  foreach ($e in $enc) {
    if ($e.ChassisTypes) {
      foreach ($t in @($e.ChassisTypes)) { $chassisTypes += [int]$t }
    }
  }

  # 笔记本类机箱代码（含可拆卸/二合一），见 SMBIOS 规范
  $laptopCodes = @(8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32)
  $isLaptopByChassis = (@($chassisTypes | Where-Object { $laptopCodes -contains $_ }).Count) -gt 0

  # 电池存在性（台式机一般无 Win32_Battery 记录）
  $hasBattery = $false
  try {
    $hasBattery = (@(Get-CimInstance -ClassName Win32_Battery -ErrorAction Stop).Count) -gt 0
  } catch {
    Write-WtLog -Level WARN -Message "Win32_Battery 查询失败：$($_.Exception.Message)"
  }

  # 综合判定：机箱为笔记本类 或 检测到电池
  $isLaptop = $isLaptopByChassis -or $hasBattery

  # 机箱类型展示名（取首个可识别代码）
  $names = @{
    3 = 'Desktop'; 4 = 'Low Profile Desktop'; 5 = 'Pizza Box'; 6 = 'Mini Tower';
    7 = 'Tower'; 8 = 'Portable'; 9 = 'Laptop'; 10 = 'Notebook'; 11 = 'Hand Held';
    12 = 'Docking Station'; 13 = 'All in One'; 14 = 'Sub Notebook'; 23 = 'Rack Mount';
    30 = 'Tablet'; 31 = 'Convertible'; 32 = 'Detachable'
  }
  $chassisName = 'Unknown'
  foreach ($c in $chassisTypes) {
    if ($names.ContainsKey($c)) { $chassisName = $names[$c]; break }
  }
  if ($chassisName -eq 'Unknown' -and @($chassisTypes).Count -gt 0) {
    $chassisName = "Type$($chassisTypes[0])"
  }

  [ordered]@{
    manufacturer    = "$($cs.Manufacturer)".Trim()
    systemFamily    = "$($cs.SystemFamily)".Trim()
    model           = "$($cs.Model)".Trim()
    chassisTypes    = @($chassisTypes)
    chassisTypeName = $chassisName
    hasBattery      = [bool]$hasBattery
    isLaptop        = [bool]$isLaptop
  }
}
