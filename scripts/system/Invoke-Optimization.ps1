# 系统优化总分发脚本（按 itemId 白名单执行）。
#
# 当前仅落地低风险项：
# - temp / recycle / wu-cache / fileext / power-ultimate
# 其余项明确返回 unimplemented，避免“假成功”。

param(
  [Parameter(Mandatory = $true)][ValidateSet('scan', 'apply')][string]$Mode,
  [Parameter(Mandatory = $true)][string]$ItemIds
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

function Add-OptResult {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Collections.Generic.List[object]]$Bag,
    [Parameter(Mandatory = $true)][string]$ItemId,
    [Parameter(Mandatory = $true)][string]$Status,
    [Parameter(Mandatory = $true)][string]$Message,
    [string]$Warning
  )
  $obj = [ordered]@{
    itemId  = $ItemId
    status  = $Status
    message = $Message
  }
  if ($Warning) { $obj.warning = $Warning }
  $Bag.Add($obj)
}

function Get-RequestedItems {
  param([string]$Raw)

  $all = @(
    'temp', 'recycle', 'wu-cache', 'fileext', 'power-ultimate',
    'winsxs', 'resetbase', 'startup', 'diagtrack', 'ceip',
    'autoplay', 'telemetry', 'xbox', 'news', 'tips'
  )
  $allowed = @{}
  foreach ($id in $all) { $allowed[$id] = $true }

  $parts = @($Raw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $dedup = New-Object System.Collections.Generic.List[string]
  $seen = @{}
  foreach ($id in $parts) {
    if (-not $allowed.ContainsKey($id)) { continue }
    if ($seen.ContainsKey($id)) { continue }
    $seen[$id] = $true
    $dedup.Add($id)
  }
  return @($dedup.ToArray())
}

function Add-ScanResult {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Collections.Generic.List[object]]$Bag,
    [Parameter(Mandatory = $true)][string]$ItemId,
    [Parameter(Mandatory = $true)][string]$Status,
    [Parameter(Mandatory = $true)][string]$Message,
    [string]$Warning
  )
  Add-OptResult -Bag $Bag -ItemId $ItemId -Status $Status -Message $Message -Warning $Warning
}

function Get-TempFileCount {
  $targets = @($env:TEMP, (Join-Path $env:WINDIR 'Temp')) | Where-Object { $_ -and (Test-Path $_) }
  $count = 0
  foreach ($dir in $targets) {
    try {
      $count += @(Get-ChildItem -Path $dir -Force -ErrorAction SilentlyContinue).Count
    } catch {}
  }
  return $count
}

function Get-RecycleBinFileCount {
  $count = 0
  $drives = @(Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)
  foreach ($drive in $drives) {
    $bin = Join-Path $drive.Root '$Recycle.Bin'
    if (-not (Test-Path $bin)) { continue }
    try {
      $count += @(Get-ChildItem -Path $bin -Force -Recurse -ErrorAction SilentlyContinue).Count
    } catch {}
  }
  return $count
}

function Get-WindowsUpdateCacheCount {
  $downloadDir = Join-Path $env:WINDIR 'SoftwareDistribution\Download'
  if (-not (Test-Path $downloadDir)) { return 0 }
  try {
    return @(Get-ChildItem -Path $downloadDir -Force -ErrorAction SilentlyContinue).Count
  } catch {
    return 0
  }
}

function Test-FileExtensionVisible {
  $explorerReg = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
  if (-not (Test-Path $explorerReg)) { return $false }
  try {
    $value = (Get-ItemProperty -Path $explorerReg -Name 'HideFileExt' -ErrorAction Stop).HideFileExt
    return ($value -eq 0)
  } catch {
    return $false
  }
}

function Test-UltimatePowerPlanActive {
  $raw = & powercfg /getactivescheme 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "读取当前电源计划失败（退出码 $LASTEXITCODE）：$raw"
  }
  $text = [string]($raw -join ' ')
  $lower = $text.ToLower()
  return ($lower.Contains('卓越性能') -or $lower.Contains('ultimate performance'))
}

function Ensure-UltimatePowerPlan {
  $ultimateBaseGuid = 'e9a42b02-d5df-448d-aa00-03f14749eb61'
  $highPerfGuid = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
  $guidPattern = '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'

  $listRaw = & powercfg /list 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "powercfg /list 执行失败（退出码 $LASTEXITCODE）：$listRaw"
  }

  $targetGuid = $null
  $targetName = $null
  foreach ($line in $listRaw) {
    $m = [regex]::Match([string]$line, "$guidPattern\s*\((.+?)\)")
    if (-not $m.Success) { continue }
    $guid = $m.Groups[1].Value
    $name = $m.Groups[2].Value.Trim()
    $lowName = $name.ToLower()
    if ($lowName.Contains('卓越性能') -or $lowName.Contains('ultimate performance') -or $guid.ToLower() -eq $ultimateBaseGuid) {
      $targetGuid = $guid
      $targetName = $name
      break
    }
  }

  if (-not $targetGuid) {
    $dupRaw = & powercfg -duplicatescheme $ultimateBaseGuid 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-WtLog -Level WARN -Message "创建卓越性能失败，回退高性能：$([string]($dupRaw -join ' '))"
      $targetGuid = $highPerfGuid
      $targetName = '高性能'
    } else {
      $dm = [regex]::Match([string]($dupRaw -join ' '), $guidPattern)
      if (-not $dm.Success) {
        $targetGuid = $highPerfGuid
        $targetName = '高性能'
      } else {
        $targetGuid = $dm.Groups[1].Value
        $targetName = '卓越性能'
      }
    }
  }

  & powercfg /setactive $targetGuid 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "切换电源计划失败：$targetGuid（退出码 $LASTEXITCODE）"
  }
  return [ordered]@{ guid = $targetGuid; name = $targetName }
}

# ===== 以下为低风险注册表/服务类优化项的公共辅助（telemetry/diagtrack/ceip/autoplay/xbox/news/tips） =====

function Get-RegValueOrNull {
  param([string]$Path, [string]$Name)
  try {
    return (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name
  } catch {
    return $null
  }
}

function Set-RegDwordWithBackup {
  param(
    [string]$Path,            # PowerShell 形式（HKCU:\... / HKLM:\...）
    [string]$RegExportPath,   # reg.exe 形式（HKCU\... / HKLM\...），用于备份
    [string]$Name,
    [int]$Value,
    [System.Collections.Generic.List[string]]$Warnings
  )
  if (Test-Path $Path) {
    try {
      $b = Backup-RegistryKey -KeyPath $RegExportPath
      $Warnings.Add("已备份注册表：$b")
    } catch {
      $Warnings.Add("注册表备份失败（$RegExportPath）：$($_.Exception.Message)")
    }
  } else {
    New-Item -Path $Path -Force | Out-Null
  }
  Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type DWord
}

# CEIP 相关计划任务路径
$script:CEIP_TASKS = @(
  '\Microsoft\Windows\Customer Experience Improvement Program\Consolidator',
  '\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip',
  '\Microsoft\Windows\Customer Experience Improvement Program\KernelCeipTask'
)
# Xbox 相关服务
$script:XBOX_SERVICES = @('XblAuthManager', 'XblGameSave', 'XboxNetApiSvc', 'XboxGipSvc')

function Test-AllServicesDisabled {
  param([string[]]$Names)
  foreach ($n in $Names) {
    $s = Get-Service -Name $n -ErrorAction SilentlyContinue
    if ($s) {
      $st = (Get-CimInstance -ClassName Win32_Service -Filter "Name='$n'" -ErrorAction SilentlyContinue).StartMode
      if ($st -and $st -ne 'Disabled') { return $false }
    }
  }
  return $true
}

function Disable-ServicesByName {
  param([string[]]$Names, [System.Collections.Generic.List[string]]$Warnings)
  foreach ($n in $Names) {
    $s = Get-Service -Name $n -ErrorAction SilentlyContinue
    if (-not $s) { continue }
    try {
      if ($s.Status -ne 'Stopped') { Stop-Service -Name $n -Force -ErrorAction SilentlyContinue }
      Set-Service -Name $n -StartupType Disabled -ErrorAction Stop
    } catch {
      $Warnings.Add("服务 $n 禁用失败：$($_.Exception.Message)")
    }
  }
}

function Scan-OptItem {
  param([string]$Item)
  switch ($Item) {
    'telemetry' {
      $v = Get-RegValueOrNull 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' 'AllowTelemetry'
      if ($null -ne $v -and [int]$v -eq 0) { return @{ status = 'optimized'; message = '遥测已设为最低（策略生效）' } }
      return @{ status = 'recommended'; message = '建议将系统遥测降到最低' }
    }
    'diagtrack' {
      $s = Get-Service -Name 'DiagTrack' -ErrorAction SilentlyContinue
      if (-not $s) { return @{ status = 'optimized'; message = '未发现遥测服务（DiagTrack）' } }
      $st = (Get-CimInstance -ClassName Win32_Service -Filter "Name='DiagTrack'" -ErrorAction SilentlyContinue).StartMode
      if ($st -eq 'Disabled') { return @{ status = 'optimized'; message = '遥测服务已禁用' } }
      return @{ status = 'recommended'; message = '建议禁用遥测服务（DiagTrack）' }
    }
    'ceip' {
      $anyEnabled = $false
      foreach ($t in $script:CEIP_TASKS) {
        $tp = Split-Path $t -Parent
        $tn = Split-Path $t -Leaf
        $task = Get-ScheduledTask -TaskPath ($tp + '\') -TaskName $tn -ErrorAction SilentlyContinue
        if ($task -and $task.State -ne 'Disabled') { $anyEnabled = $true }
      }
      if ($anyEnabled) { return @{ status = 'recommended'; message = '建议关闭客户体验改善计划任务' } }
      return @{ status = 'optimized'; message = '客户体验改善计划任务已关闭' }
    }
    'autoplay' {
      $v = Get-RegValueOrNull 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers' 'DisableAutoplay'
      if ($null -ne $v -and [int]$v -eq 1) { return @{ status = 'optimized'; message = '自动播放已关闭' } }
      return @{ status = 'recommended'; message = '建议关闭所有媒体的自动播放' }
    }
    'xbox' {
      $svcDisabled = Test-AllServicesDisabled -Names $script:XBOX_SERVICES
      $dvr = Get-RegValueOrNull 'HKCU:\System\GameConfigStore' 'GameDVR_Enabled'
      if ($svcDisabled -and ($null -ne $dvr) -and [int]$dvr -eq 0) {
        return @{ status = 'optimized'; message = 'Xbox 服务与游戏录制已关闭' }
      }
      return @{ status = 'recommended'; message = '建议关闭 Xbox 后台服务与游戏录制（GameDVR）' }
    }
    'news' {
      $dsh = Get-RegValueOrNull 'HKLM:\SOFTWARE\Policies\Microsoft\Dsh' 'AllowNewsAndInterests'
      $feeds = Get-RegValueOrNull 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Feeds' 'EnableFeeds'
      if ((($null -ne $dsh) -and [int]$dsh -eq 0) -or (($null -ne $feeds) -and [int]$feeds -eq 0)) {
        return @{ status = 'optimized'; message = '资讯与兴趣/小组件已关闭' }
      }
      return @{ status = 'recommended'; message = '建议关闭任务栏资讯与兴趣/小组件' }
    }
    'tips' {
      $v = Get-RegValueOrNull 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager' 'SubscribedContent-338389Enabled'
      if (($null -ne $v) -and [int]$v -eq 0) { return @{ status = 'optimized'; message = '系统建议与提示已关闭' } }
      return @{ status = 'recommended'; message = '建议关闭系统建议与小贴士推送' }
    }
    default { return $null }
  }
}

function Apply-OptItem {
  param([string]$Item, [System.Collections.Generic.List[string]]$Warnings)
  switch ($Item) {
    'telemetry' {
      Set-RegDwordWithBackup -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -RegExportPath 'HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection' -Name 'AllowTelemetry' -Value 0 -Warnings $Warnings
      return '已将系统遥测降到最低'
    }
    'diagtrack' {
      Disable-ServicesByName -Names @('DiagTrack', 'dmwappushservice') -Warnings $Warnings
      return '已禁用遥测相关服务'
    }
    'ceip' {
      foreach ($t in $script:CEIP_TASKS) {
        $tp = Split-Path $t -Parent
        $tn = Split-Path $t -Leaf
        try {
          Disable-ScheduledTask -TaskPath ($tp + '\') -TaskName $tn -ErrorAction Stop | Out-Null
        } catch {
          $Warnings.Add("关闭任务失败（$tn）：$($_.Exception.Message)")
        }
      }
      return '已关闭客户体验改善计划任务'
    }
    'autoplay' {
      Set-RegDwordWithBackup -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers' -RegExportPath 'HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers' -Name 'DisableAutoplay' -Value 1 -Warnings $Warnings
      return '已关闭自动播放'
    }
    'xbox' {
      Disable-ServicesByName -Names $script:XBOX_SERVICES -Warnings $Warnings
      Set-RegDwordWithBackup -Path 'HKCU:\System\GameConfigStore' -RegExportPath 'HKCU\System\GameConfigStore' -Name 'GameDVR_Enabled' -Value 0 -Warnings $Warnings
      Set-RegDwordWithBackup -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' -RegExportPath 'HKCU\Software\Microsoft\Windows\CurrentVersion\GameDVR' -Name 'AppCaptureEnabled' -Value 0 -Warnings $Warnings
      return '已关闭 Xbox 后台服务与游戏录制'
    }
    'news' {
      Set-RegDwordWithBackup -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Dsh' -RegExportPath 'HKLM\SOFTWARE\Policies\Microsoft\Dsh' -Name 'AllowNewsAndInterests' -Value 0 -Warnings $Warnings
      Set-RegDwordWithBackup -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Feeds' -RegExportPath 'HKLM\SOFTWARE\Policies\Microsoft\Windows\Windows Feeds' -Name 'EnableFeeds' -Value 0 -Warnings $Warnings
      return '已关闭资讯与兴趣/小组件'
    }
    'tips' {
      $cdm = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'
      $cdmExport = 'HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'
      Set-RegDwordWithBackup -Path $cdm -RegExportPath $cdmExport -Name 'SubscribedContent-338389Enabled' -Value 0 -Warnings $Warnings
      Set-ItemProperty -Path $cdm -Name 'SoftLandingEnabled' -Value 0 -Type DWord
      Set-ItemProperty -Path $cdm -Name 'SystemPaneSuggestionsEnabled' -Value 0 -Type DWord
      return '已关闭系统建议与小贴士推送'
    }
    default { return $null }
  }
}

Invoke-WtScript -ErrorCode 'E_OPT' -Body {
  $items = @(Get-RequestedItems -Raw $ItemIds)
  if ($items.Count -eq 0) {
    throw '未收到有效优化项（白名单为空）'
  }

  $results = New-Object System.Collections.Generic.List[object]
  $warnings = New-Object System.Collections.Generic.List[string]

  if ($Mode -eq 'scan') {
    foreach ($item in $items) {
      try {
        switch ($item) {
          'temp' {
            $count = Get-TempFileCount
            if ($count -gt 0) {
              Add-ScanResult -Bag $results -ItemId $item -Status 'recommended' -Message "检测到 $count 个临时文件，建议清理"
            } else {
              Add-ScanResult -Bag $results -ItemId $item -Status 'optimized' -Message '临时目录已较干净'
            }
          }
          'recycle' {
            $count = Get-RecycleBinFileCount
            if ($count -gt 0) {
              Add-ScanResult -Bag $results -ItemId $item -Status 'recommended' -Message "回收站存在 $count 个项目，建议清理"
            } else {
              Add-ScanResult -Bag $results -ItemId $item -Status 'optimized' -Message '回收站已清空'
            }
          }
          'wu-cache' {
            $count = Get-WindowsUpdateCacheCount
            if ($count -gt 0) {
              Add-ScanResult -Bag $results -ItemId $item -Status 'recommended' -Message "检测到 $count 个更新缓存项目，建议清理"
            } else {
              Add-ScanResult -Bag $results -ItemId $item -Status 'optimized' -Message '更新缓存已较干净'
            }
          }
          'fileext' {
            if (Test-FileExtensionVisible) {
              Add-ScanResult -Bag $results -ItemId $item -Status 'optimized' -Message '当前已显示文件扩展名'
            } else {
              Add-ScanResult -Bag $results -ItemId $item -Status 'recommended' -Message '建议开启显示文件扩展名'
            }
          }
          'power-ultimate' {
            if (Test-UltimatePowerPlanActive) {
              Add-ScanResult -Bag $results -ItemId $item -Status 'optimized' -Message '当前已启用卓越性能电源计划'
            } else {
              Add-ScanResult -Bag $results -ItemId $item -Status 'recommended' -Message '建议切换到卓越性能电源计划'
            }
          }
          'winsxs' {
            Add-ScanResult -Bag $results -ItemId $item -Status 'unimplemented' -Message '组件清理（WinSxS）耗时较长，已保留为高级项，暂不在常规体检中执行'
          }
          'resetbase' {
            Add-ScanResult -Bag $results -ItemId $item -Status 'unimplemented' -Message 'ResetBase 不可逆（清除组件回滚点），默认不开启'
          }
          'startup' {
            Add-ScanResult -Bag $results -ItemId $item -Status 'unimplemented' -Message '启动项建议在任务管理器中手动确认，暂不自动处置'
          }
          default {
            $scan = Scan-OptItem -Item $item
            if ($scan) {
              Add-ScanResult -Bag $results -ItemId $item -Status $scan.status -Message $scan.message
            } else {
              Add-ScanResult -Bag $results -ItemId $item -Status 'unimplemented' -Message '该优化项暂未实现体检逻辑'
            }
          }
        }
      } catch {
        Add-ScanResult -Bag $results -ItemId $item -Status 'unavailable' -Message "体检失败：$($_.Exception.Message)"
      }
    }

    $all = @($results.ToArray())
    $recommendedCount = (@($all | Where-Object { $_.status -eq 'recommended' })).Count
    $optimizedCount = (@($all | Where-Object { $_.status -eq 'optimized' })).Count
    $unavailableCount = (@($all | Where-Object { $_.status -eq 'unavailable' })).Count
    $unimplCount = (@($all | Where-Object { $_.status -eq 'unimplemented' })).Count

    return [ordered]@{
      mode = 'scan'
      summary = "建议优化 $recommendedCount 项，已优化 $optimizedCount 项，不可用 $unavailableCount 项，未实现 $unimplCount 项"
      warnings = @($warnings.ToArray())
      results = $all
    }
  }

  foreach ($item in $items) {
    try {
      switch ($item) {
        'temp' {
          $targets = @($env:TEMP, (Join-Path $env:WINDIR 'Temp')) | Where-Object { $_ -and (Test-Path $_) }
          foreach ($dir in $targets) {
            Get-ChildItem -Path $dir -Force -ErrorAction SilentlyContinue |
              Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
          }
          Add-OptResult -Bag $results -ItemId $item -Status 'success' -Message '临时文件清理完成'
        }
        'recycle' {
          Clear-RecycleBin -Force -ErrorAction SilentlyContinue -Confirm:$false
          Add-OptResult -Bag $results -ItemId $item -Status 'success' -Message '回收站已清空'
        }
        'wu-cache' {
          $svcNames = @('wuauserv', 'bits')
          foreach ($svc in $svcNames) {
            $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
            if ($s -and $s.Status -ne 'Stopped') {
              Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
            }
          }
          $downloadDir = Join-Path $env:WINDIR 'SoftwareDistribution\Download'
          if (Test-Path $downloadDir) {
            Get-ChildItem -Path $downloadDir -Force -ErrorAction SilentlyContinue |
              Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
          }
          foreach ($svc in $svcNames) {
            $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
            if ($s -and $s.Status -ne 'Running') {
              Start-Service -Name $svc -ErrorAction SilentlyContinue
            }
          }
          Add-OptResult -Bag $results -ItemId $item -Status 'success' -Message 'Windows 更新缓存清理完成'
        }
        'fileext' {
          $explorerReg = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
          if (Test-Path $explorerReg) {
            try {
              $backup = Backup-RegistryKey -KeyPath 'HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
              $warnings.Add("已备份资源管理器设置：$backup")
            } catch {
              $warnings.Add("资源管理器设置备份失败：$($_.Exception.Message)")
            }
          }
          if (-not (Test-Path $explorerReg)) {
            New-Item -Path $explorerReg -Force | Out-Null
          }
          Set-ItemProperty -Path $explorerReg -Name 'HideFileExt' -Value 0 -Type DWord
          Add-OptResult -Bag $results -ItemId $item -Status 'success' -Message '已启用显示文件扩展名'
        }
        'power-ultimate' {
          $plan = Ensure-UltimatePowerPlan
          Add-OptResult -Bag $results -ItemId $item -Status 'success' -Message "已切换到电源计划：$($plan.name)"
        }
        'winsxs' {
          Add-OptResult -Bag $results -ItemId $item -Status 'unimplemented' -Message '组件清理（WinSxS）为高级项，耗时较长，暂不在常规优化中执行'
        }
        'resetbase' {
          Add-OptResult -Bag $results -ItemId $item -Status 'unimplemented' -Message 'ResetBase 不可逆，默认不开启（保留安全边界）'
        }
        'startup' {
          Add-OptResult -Bag $results -ItemId $item -Status 'unimplemented' -Message '启动项请在任务管理器中手动管理，避免误禁关键项'
        }
        default {
          $msg = Apply-OptItem -Item $item -Warnings $warnings
          if ($msg) {
            Add-OptResult -Bag $results -ItemId $item -Status 'success' -Message $msg
          } else {
            Add-OptResult -Bag $results -ItemId $item -Status 'unimplemented' -Message '该优化项暂未实现'
          }
        }
      }
    } catch {
      Add-OptResult -Bag $results -ItemId $item -Status 'failed' -Message "执行失败：$($_.Exception.Message)"
    }
  }

  $all = @($results.ToArray())
  $failCount = (@($all | Where-Object { $_.status -eq 'failed' })).Count
  $okCount = (@($all | Where-Object { $_.status -eq 'success' })).Count
  $unimplCount = (@($all | Where-Object { $_.status -eq 'unimplemented' })).Count

  [ordered]@{
    mode = 'apply'
    success = ($failCount -eq 0)
    summary = "成功 $okCount 项，失败 $failCount 项，未实现 $unimplCount 项"
    warnings = @($warnings.ToArray())
    results = $all
  }
}
