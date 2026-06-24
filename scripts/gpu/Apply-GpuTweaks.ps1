# 批量应用显卡调优项（可组合执行，逐项返回 success/failed/skipped + 原因）。
#
# 当前落地项：
# - nvidia-low-latency：NVIDIA 持久模式 + WinTuner 预设标记
# - enable-hags：开启硬件加速 GPU 调度
# - enable-game-mode：开启 Windows 游戏模式
# - power-plan-performance：切换到现有性能向电源计划（不新建）
# - nvidia-profile：NVIDIA 控制面板竞技预设（图像/OpenGL/电源/刷新率）

param(
  [Parameter(Mandatory = $true)][string]$OptionIds
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

function Add-ItemResult {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[object]]$Bag,
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][string]$Status,
    [Parameter(Mandatory = $true)][string]$Reason
  )
  $Bag.Add([ordered]@{
    id     = $Id
    status = $Status
    reason = $Reason
  })
}

function Add-UniqueWarning {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Warnings,
    [Parameter(Mandatory = $true)][string]$Message
  )
  if ([string]::IsNullOrWhiteSpace($Message)) { return }
  if (-not $Warnings.Contains($Message)) {
    $Warnings.Add($Message)
  }
}

function Invoke-WtChildScript {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [string[]]$ScriptArgs = @()
  )
  if (-not (Test-Path $ScriptPath)) {
    throw "子脚本不存在：$ScriptPath"
  }
  $prevOut = [Console]::Out
  $capture = New-Object System.IO.StringWriter
  [Console]::SetOut($capture)
  try {
    if ($ScriptArgs.Count -gt 0) {
      & $ScriptPath @ScriptArgs
    } else {
      & $ScriptPath
    }
  } finally {
    [Console]::SetOut($prevOut)
  }
  $text = $capture.ToString().Trim()
  if ([string]::IsNullOrWhiteSpace($text)) {
    throw '子脚本无 stdout 输出'
  }
  $envelope = $text | ConvertFrom-Json -ErrorAction Stop
  if (-not $envelope.ok) {
    $msg = [string]$envelope.error.message
    throw "子脚本返回失败：$msg"
  }
  return $envelope.data
}

function Get-RequestedOptions {
  param([string]$Raw)
  $all = @('nvidia-low-latency', 'enable-hags', 'enable-game-mode', 'power-plan-performance', 'nvidia-profile')
  $allow = @{}
  foreach ($id in $all) { $allow[$id] = $true }

  $parts = @($Raw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $seen = @{}
  $result = New-Object System.Collections.Generic.List[string]
  foreach ($id in $parts) {
    if (-not $allow.ContainsKey($id)) { continue }
    if ($seen.ContainsKey($id)) { continue }
    $seen[$id] = $true
    $result.Add($id)
  }
  return @($result.ToArray())
}

function Test-NvidiaPresent {
  $cards = @(Get-WtCimInstance -ClassName 'Win32_VideoController')
  foreach ($card in $cards) {
    $name = [string]$card.Name
    $pnp = [string]$card.PNPDeviceID
    if ($name -match 'NVIDIA' -or $pnp -match 'VEN_10DE') {
      return $true
    }
  }
  return $false
}

function Select-PerformancePlan {
  $guidPattern = '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'
  $highGuid = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
  $ultimateGuid = 'e9a42b02-d5df-448d-aa00-03f14749eb61'

  $listRaw = & powercfg /list 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "powercfg /list 执行失败（退出码 $LASTEXITCODE）"
  }

  $plans = @()
  foreach ($line in $listRaw) {
    $m = [regex]::Match([string]$line, "$guidPattern\s*\((.+?)\)")
    if (-not $m.Success) { continue }
    $plans += [ordered]@{
      guid = $m.Groups[1].Value
      name = $m.Groups[2].Value.Trim()
    }
  }

  $target = $plans | Where-Object {
    $name = ([string]$_.name).ToLower()
    $guid = ([string]$_.guid).ToLower()
    $name.Contains('卓越性能') -or $name.Contains('ultimate performance') -or $name.Contains('turbo') -or $guid -eq $ultimateGuid
  } | Select-Object -First 1

  if (-not $target) {
    $target = $plans | Where-Object {
      $name = ([string]$_.name).ToLower()
      $guid = ([string]$_.guid).ToLower()
      $name.Contains('高性能') -or $name.Contains('performance') -or $guid -eq $highGuid
    } | Select-Object -First 1
  }

  return $target
}

Invoke-WtScript -ErrorCode 'E_GPU_TWEAK' -Body {
  $ids = @(Get-RequestedOptions -Raw $OptionIds)
  if ($ids.Count -eq 0) {
    throw '未收到有效调节项'
  }

  $results = New-Object System.Collections.Generic.List[object]
  $warnings = New-Object System.Collections.Generic.List[string]

  foreach ($id in $ids) {
    try {
      switch ($id) {
        'nvidia-low-latency' {
          if (-not (Test-NvidiaPresent)) {
            Add-ItemResult -Bag $results -Id $id -Status 'skipped' -Reason '未检测到 NVIDIA 主显卡'
            break
          }

          $appRegPath = 'HKCU:\Software\WinTunerPro\Gpu'
          if (-not (Test-Path $appRegPath)) {
            New-Item -Path $appRegPath -Force | Out-Null
          }
          Set-ItemProperty -Path $appRegPath -Name 'NvidiaPreset' -Value 'competitive' -Type String
          Set-ItemProperty -Path $appRegPath -Name 'LastAppliedAt' -Value ((Get-Date).ToString('s')) -Type String

          $smi = Get-Command 'nvidia-smi.exe' -ErrorAction SilentlyContinue
          if ($null -eq $smi) {
            Add-UniqueWarning -Warnings $warnings -Message '未找到 nvidia-smi，已仅写入低延迟预设标记'
            Add-ItemResult -Bag $results -Id $id -Status 'success' -Reason '已写入低延迟预设标记（缺少 nvidia-smi）'
            break
          }

          $raw = & $smi.Source -pm 1 2>&1
          if ($LASTEXITCODE -ne 0) {
            Add-ItemResult -Bag $results -Id $id -Status 'failed' -Reason "nvidia-smi 设置失败：$([string]($raw -join ' '))"
            break
          }
          Add-ItemResult -Bag $results -Id $id -Status 'success' -Reason '已启用 NVIDIA 持久模式并写入低延迟标记'
        }
        'enable-hags' {
          $regPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers'
          if (-not (Test-Path $regPath)) {
            New-Item -Path $regPath -Force | Out-Null
          }
          Set-ItemProperty -Path $regPath -Name 'HwSchMode' -Value 2 -Type DWord
          Add-ItemResult -Bag $results -Id $id -Status 'success' -Reason '已开启 HAGS（重启后生效）'
        }
        'enable-game-mode' {
          $regPath = 'HKCU:\Software\Microsoft\GameBar'
          if (-not (Test-Path $regPath)) {
            New-Item -Path $regPath -Force | Out-Null
          }
          Set-ItemProperty -Path $regPath -Name 'AutoGameModeEnabled' -Value 1 -Type DWord
          Set-ItemProperty -Path $regPath -Name 'AllowAutoGameMode' -Value 1 -Type DWord
          Add-ItemResult -Bag $results -Id $id -Status 'success' -Reason '已开启 Windows 游戏模式'
        }
        'power-plan-performance' {
          $target = Select-PerformancePlan
          if ($null -eq $target) {
            Add-ItemResult -Bag $results -Id $id -Status 'skipped' -Reason '未找到可用的性能向电源计划'
            break
          }
          & powercfg /setactive $target.guid 2>&1 | Out-Null
          if ($LASTEXITCODE -ne 0) {
            Add-ItemResult -Bag $results -Id $id -Status 'failed' -Reason "切换电源计划失败：$($target.guid)"
            break
          }
          Add-ItemResult -Bag $results -Id $id -Status 'success' -Reason "已切换到电源计划：$($target.name)"
        }
        'nvidia-profile' {
          $profileScript = Join-Path $PSScriptRoot 'Set-NvidiaProfile.ps1'
          if (-not (Test-Path $profileScript)) {
            Add-ItemResult -Bag $results -Id $id -Status 'failed' `
              -Reason 'Set-NvidiaProfile.ps1 不存在，请确认脚本已部署'
            break
          }
          try {
            $prObj = Invoke-WtChildScript -ScriptPath $profileScript
            if ($prObj.success) {
              $msg = [string]$prObj.message
              foreach ($w in @($prObj.warnings)) {
                Add-UniqueWarning -Warnings $warnings -Message ([string]$w)
              }
              if ($prObj.requiresDriverRestart) {
                Add-UniqueWarning -Warnings $warnings -Message '电源管理模式变更需重启驱动（或重启系统）后完全生效'
              }
              Add-ItemResult -Bag $results -Id $id -Status 'success' -Reason $msg
            } else {
              $skips = @($prObj.skippedItems) -join '；'
              Add-ItemResult -Bag $results -Id $id -Status 'failed' -Reason "部分项跳过：$skips"
            }
          } catch {
            Add-ItemResult -Bag $results -Id $id -Status 'failed' `
              -Reason "调用 Set-NvidiaProfile.ps1 失败：$($_.Exception.Message)"
          }
        }
      }
    } catch {
      Add-ItemResult -Bag $results -Id $id -Status 'failed' -Reason "执行异常：$($_.Exception.Message)"
    }
  }

  $all = @($results.ToArray())
  $ok = (@($all | Where-Object { $_.status -eq 'success' })).Count
  $failed = (@($all | Where-Object { $_.status -eq 'failed' })).Count
  $skipped = (@($all | Where-Object { $_.status -eq 'skipped' })).Count

  [ordered]@{
    success = ($failed -eq 0)
    summary = "成功 $ok 项，失败 $failed 项，跳过 $skipped 项"
    warnings = @($warnings.ToArray())
    results = $all
  }
}
