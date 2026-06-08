# WinTuner Pro PowerShell 公共函数库
#
# 供 system / gpu / oem 脚本 dot-source 复用。统一约定：
#   - stdout 只输出一行最终 JSON（成功 { ok:true; data } / 失败 { ok:false; error:{code,message} }），
#     便于主进程稳健解析；任何日志/进度信息一律走 stderr，避免污染 JSON。
#   - 强制 UTF-8 输出，确保中文（如电源方案名“平衡”、品牌名）不乱码。
#
# 注意：系统级操作无法在开发环境完整实测，本库以「健壮防御 + 明确错误码」为原则，
#       真实行为需在 Windows 管理员环境验证。

# 统一以 UTF-8（无 BOM）输出，主进程按 utf8 解码
try {
  [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {
  # 个别受限环境可能无法设置控制台编码，忽略不致命
}

# 出错即抛，交由各脚本的 try/catch 统一兜底为结构化错误
$ErrorActionPreference = 'Stop'

<#
.SYNOPSIS 写日志到 stderr（不污染 stdout 的 JSON）。
#>
function Write-WtLog {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO'
  )
  $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  [Console]::Error.WriteLine("[$ts][$Level] $Message")
}

<#
.SYNOPSIS 统一 JSON 序列化（固定深度，防止 PowerShell 默认 2 层深度截断）。
#>
function ConvertTo-WtJson {
  param([Parameter(Mandatory = $true)]$InputObject)
  return ($InputObject | ConvertTo-Json -Depth 8 -Compress)
}

<#
.SYNOPSIS 输出成功结果包装 { ok = $true; data = ... }。
#>
function Write-WtSuccess {
  param($Data)
  $payload = [ordered]@{ ok = $true; data = $Data }
  [Console]::Out.WriteLine((ConvertTo-WtJson $payload))
}

<#
.SYNOPSIS 输出失败结果包装 { ok = $false; error = { code; message } }。
#>
function Write-WtFailure {
  param(
    [Parameter(Mandatory = $true)][string]$Code,
    [Parameter(Mandatory = $true)][string]$Message
  )
  $payload = [ordered]@{ ok = $false; error = [ordered]@{ code = $Code; message = $Message } }
  [Console]::Out.WriteLine((ConvertTo-WtJson $payload))
}

<#
.SYNOPSIS 统一执行入口：执行脚本主体，成功输出 data，异常兜底为结构化错误码。
.DESCRIPTION 各脚本把核心逻辑放进 -Body 脚本块，由本函数负责 try/catch 与 JSON 包装，
            保证无论成败 stdout 都只有一行可解析 JSON，且进程退出码为 0（错误经 ok:false 表达）。
#>
function Invoke-WtScript {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Body,
    [string]$ErrorCode = 'E_RUNTIME'
  )
  try {
    $data = & $Body
    Write-WtSuccess $data
  } catch {
    Write-WtLog -Level ERROR -Message $_.Exception.Message
    Write-WtFailure -Code $ErrorCode -Message $_.Exception.Message
  }
}

<#
.SYNOPSIS WMI/CIM 查询封装，优先 Get-CimInstance，失败回退 Get-WmiObject。
.DESCRIPTION 兼顾新老系统：部分精简/老旧系统 WinRM/CIM 不可用时回退 WMI。
            命名空间对 CIM 用 'root/cimv2'，WMI 自动转换为反斜杠形式。
#>
function Get-WtCimInstance {
  param(
    [Parameter(Mandatory = $true)][string]$ClassName,
    [string]$Namespace = 'root/cimv2',
    [string]$Filter
  )
  try {
    if ($Filter) {
      return Get-CimInstance -ClassName $ClassName -Namespace $Namespace -Filter $Filter -ErrorAction Stop
    }
    return Get-CimInstance -ClassName $ClassName -Namespace $Namespace -ErrorAction Stop
  } catch {
    Write-WtLog -Level WARN -Message "Get-CimInstance $ClassName 失败，回退 Get-WmiObject：$($_.Exception.Message)"
    $wmiNs = $Namespace -replace '/', '\'
    if ($Filter) {
      return Get-WmiObject -Class $ClassName -Namespace $wmiNs -Filter $Filter -ErrorAction Stop
    }
    return Get-WmiObject -Class $ClassName -Namespace $wmiNs -ErrorAction Stop
  }
}

<#
.SYNOPSIS 注册表键备份占位函数（供后续写操作复用，本期读操作不调用）。
.DESCRIPTION 用 reg.exe export 导出 .reg，路径含时间戳避免覆盖。
            备份目录默认 %AppData%\WinTunerPro\backups。
#>
function Backup-RegistryKey {
  param(
    [Parameter(Mandatory = $true)][string]$KeyPath,
    [string]$BackupDir = (Join-Path $env:APPDATA 'WinTunerPro\backups')
  )
  if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }
  $safe = ($KeyPath -replace '[\\:/* ?"<>|]', '_')
  $file = Join-Path $BackupDir ("{0}_{1}.reg" -f $safe, (Get-Date).ToString('yyyyMMdd_HHmmss'))
  Write-WtLog "备份注册表 $KeyPath -> $file"
  & reg.exe export $KeyPath $file /y | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "注册表备份失败：$KeyPath（reg.exe 退出码 $LASTEXITCODE）" }
  return $file
}

<#
.SYNOPSIS 系统还原点占位函数（供后续写操作复用，本期读操作不调用）。
.DESCRIPTION 失败不致命（多数家庭版/未启用系统保护时无法创建），仅记录告警。
#>
function Checkpoint-WtRestorePoint {
  param([string]$Description = 'WinTuner Pro 操作前还原点')
  try {
    Checkpoint-Computer -Description $Description -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
    Write-WtLog "已创建系统还原点：$Description"
    return $true
  } catch {
    Write-WtLog -Level WARN -Message "创建还原点失败（可能未启用系统保护）：$($_.Exception.Message)"
    return $false
  }
}
