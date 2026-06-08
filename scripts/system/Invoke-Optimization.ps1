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
          default {
            Add-ScanResult -Bag $results -ItemId $item -Status 'unimplemented' -Message '该优化项暂未实现体检逻辑'
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
        default {
          Add-OptResult -Bag $results -ItemId $item -Status 'unimplemented' -Message '该优化项暂未实现'
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
