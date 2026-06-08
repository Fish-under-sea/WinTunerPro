# 应用 OEM 品牌性能模式（当前重点：Lenovo / Asus）。
#
# 输出（结构化）：
# {
#   success: bool,              # 品牌专属调度是否成功
#   appliedBrandMode: bool,     # 是否成功执行品牌调度
#   usedBrandMode: bool,        # 兼容旧字段（等同 appliedBrandMode）
#   fallbackUsed: bool,         # 是否建议主进程走电源计划兜底
#   brand: string,
#   mode: string,
#   message: string,
#   warnings: string[],
#   details: object             # 检测与尝试明细，便于前端/日志展示
# }

param(
  [Parameter(Mandatory = $true)][string]$Brand,
  [ValidateSet('quiet', 'balanced', 'performance', 'beast')][string]$Mode
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

function Add-UniqueWarning {
  param(
    [Parameter(Mandatory = $true)]$Warnings,
    [Parameter(Mandatory = $true)][string]$Message
  )
  if ($null -eq $Warnings) { return }
  if (-not [string]::IsNullOrWhiteSpace($Message) -and -not $Warnings.Contains($Message)) {
    $Warnings.Add($Message)
  }
}

function Format-Text {
  param(
    [Parameter(Mandatory = $true)][string]$Template,
    [Parameter()][object[]]$Args = @()
  )
  return [string]::Format($Template, $Args)
}

function Test-AsusAtkWmiBridge {
  try {
    $klass = Get-CimClass -Namespace 'root/wmi' -ClassName 'AsusAtkWmi_WMNB' -ErrorAction Stop
    return ($null -ne $klass)
  } catch {
    return $false
  }
}

function Set-AsusMode {
  param(
    [Parameter(Mandatory = $true)][string]$Mode,
    [System.Collections.Generic.List[string]]$Warnings,
    [Parameter(Mandatory = $true)]$DetailBag
  )

  $labelMap = @{
    quiet       = 'silent'
    balanced    = 'balanced'
    performance = 'performance'
    beast       = 'turbo'
  }

  $profileLabel = $labelMap[$Mode]
  $DetailBag.asus = [ordered]@{
    profileLabel    = $profileLabel
    strategy        = 'safe-fallback'
    path            = 'fallback-only'
    blockedInvokes  = @(
      'ASUS\ARMOURY CRATE Service\ArmouryCrate.Service.exe',
      'ASUS\ARMOURY CRATE Service\ArmouryCrate.UserSessionHelper.exe'
    )
    invokeForbidden = $true
  }

  # 保守安全策略：
  # 当前未确认稳定、静默、官方可调用入口；为了避免重复确认弹窗/骚扰，不做品牌写入尝试。
  # 只记录环境探测信息，交由主进程执行电源计划兜底。
  $wmiBridgeOk = Test-AsusAtkWmiBridge
  $DetailBag.asus.wmiBridgeDetected = [bool]$wmiBridgeOk
  $armouryEvidence = @(
    (Join-Path $env:ProgramFiles 'ASUS\ARMOURY CRATE Service\AsusOptimization.exe'),
    (Join-Path $env:ProgramFiles 'ASUS\ARMOURY CRATE Service\ArmouryCrate.Service.exe'),
    (Join-Path $env:ProgramFiles 'ASUS\ARMOURY CRATE Service\ArmouryCrate.UserSessionHelper.exe')
  )
  $existing = @($armouryEvidence | Where-Object { Test-Path $_ })

  $serviceNames = @('ArmouryCrateService', 'ASUSOptimization', 'AsusOptimization', 'ASUSLinkNear')
  $serviceHits = @()
  foreach ($svc in $serviceNames) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($null -ne $s) { $serviceHits += [string]$svc }
  }

  $DetailBag.asus.armouryComponents = @($existing)
  $DetailBag.asus.detectedServices = @($serviceHits)
  $DetailBag.asus.brandAttemptCount = 0
  Add-UniqueWarning -Warnings $Warnings -Message 'Asus/ROG 品牌接口已禁用 Service/UserSessionHelper 调用，已使用电源计划兜底'
  return $false
}

Invoke-WtScript -ErrorCode 'E_OEM_APPLY' -Body {
  $warnings = New-Object System.Collections.Generic.List[string]
  $brand = [string]$Brand
  $mode = [string]$Mode
  $appliedBrandMode = $false
  $details = [ordered]@{
    requestedBrand = $brand
    requestedMode  = $mode
    branch         = 'none'
  }

  switch ($brand) {
    'Lenovo' {
      $details.branch = 'Lenovo'
      $lenovoCandidates = @(
        (Join-Path $env:ProgramFiles 'Lenovo\LegionZone\LegionZone.exe'),
        (Join-Path $env:ProgramFiles 'Lenovo\VantageService\VantageService.exe')
      )
      $entry = @($lenovoCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1)
      $details.lenovo = [ordered]@{ brandAttemptCount = 0; entry = if ($entry.Count -gt 0) { $entry[0] } else { $null } }

      if ($entry.Count -gt 0) {
        $details.lenovo.brandAttemptCount = 1
        try {
          $output = & $entry[0] '--set-performance-mode' $mode 2>&1
          $exitCode = $LASTEXITCODE
          $details.lenovo.exitCode = $exitCode
          if ($exitCode -eq 0) {
            $appliedBrandMode = $true
          } else {
            Add-UniqueWarning -Warnings $warnings -Message (Format-Text -Template 'Lenovo 品牌调度失败（退出码 {0}），已使用电源计划兜底' -Args @($exitCode))
          }
          $details.lenovo.output = [string]($output -join ' ')
        } catch {
          $msg = [string]$_.Exception.Message
          if ($msg -match '(?i)operation was canceled by the user|0x4c7|访问被拒绝|access is denied|unauthorized|permission|拒绝访问|参数|parameter|method|方法') {
            Add-UniqueWarning -Warnings $warnings -Message 'Lenovo 品牌调度触发熔断（权限/参数/用户取消），已使用电源计划兜底'
            $details.lenovo.circuitBroken = $true
          } else {
            Add-UniqueWarning -Warnings $warnings -Message 'Lenovo 品牌调度异常，已使用电源计划兜底'
          }
          $details.lenovo.error = $msg
        }
      }

      if (-not $appliedBrandMode) {
        Add-UniqueWarning -Warnings $warnings -Message '未找到可用的 Lenovo 性能调度接口，将由主进程转入电源计划兜底'
      }
    }
    'Asus' {
      $details.branch = 'Asus'
      $appliedBrandMode = Set-AsusMode -Mode $mode -Warnings $warnings -DetailBag $details
      if (-not $appliedBrandMode) {
        # 详细原因已在 Set-AsusMode 内聚合，这里不重复堆叠告警。
      }
    }
    default {
      $details.branch = 'default'
      Add-UniqueWarning -Warnings $warnings -Message (Format-Text -Template '品牌 {0} 暂未实现专属调度，将由主进程转入电源计划兜底' -Args @($brand))
    }
  }

  $fallbackUsed = -not $appliedBrandMode
  $msg = if ($appliedBrandMode) {
    Format-Text -Template '{0} 专属模式已应用：{1}' -Args @($brand, $mode)
  } else {
    Format-Text -Template '{0} 专属模式未生效，建议使用电源计划兜底' -Args @($brand)
  }

  [ordered]@{
    success          = [bool]$appliedBrandMode
    appliedBrandMode = [bool]$appliedBrandMode
    usedBrandMode    = [bool]$appliedBrandMode
    fallbackUsed     = [bool]$fallbackUsed
    brand            = $brand
    mode             = $mode
    message          = $msg
    warnings         = @($warnings.ToArray())
    details          = $details
  }
}
