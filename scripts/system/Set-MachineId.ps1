# WinTuner Pro —— 重置机器标识（写：注册表 MachineGuid / 可选遥测 MachineId）
#
# 合规边界（项目红线，务必遵守）：
#   - 仅做「合法的机器标识重置」，语义等价于“重装/重置系统后获得新的系统标识”。
#   - 严禁任何反作弊绕过 / 封禁规避 / 硬件指纹（磁盘序列号、网卡 MAC、主板/CPU ID）伪造逻辑。
#   - 本脚本只改写软件层注册表标识，不触碰任何硬件标识，也不读写网卡/磁盘/主板序列号。
#
# 可重置项：
#   1) HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid —— 重新生成一个标准 GUID（REG_SZ，小写无花括号）。
#   2) （可选，更高风险）HKLM\SOFTWARE\Microsoft\SQMClient\MachineId —— 遥测/体验改善标识（花括号大写 GUID）。
#
# 安全：
#   - 写前先把将被修改的注册表值导出为单个 .reg 快照（UTF-16 LE，reg import 可直接还原），落在 -BackupDir。
#   - 返回结构含 旧值/新值/备份路径/是否需重启/warnings，供主进程解析（对应 shared/types/reinstall.ts）。
#
# 注意：MachineGuid 变更需重启后对多数依赖方才完全生效；部分软件授权/激活可能因此需要重新激活。

param(
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [string]$NewGuid = '',
  [string]$NewTelemetryId = '',
  [switch]$ResetTelemetryId
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

# 标准 GUID 形态（与主进程 powershellRunner.isGuid 保持一致；防注入/防脏数据写入注册表）
$GUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

$CRYPTO_KEY_PS = 'HKLM:\SOFTWARE\Microsoft\Cryptography'
$SQM_KEY_PS = 'HKLM:\SOFTWARE\Microsoft\SQMClient'

# 把一个注册表字符串值转义为 .reg 文件中的合法字面量（反斜杠与双引号需转义）
function ConvertTo-RegLiteral {
  param([string]$Value)
  return ($Value -replace '\\', '\\' -replace '"', '\"')
}

Invoke-WtScript -ErrorCode 'E_REINSTALL' -Body {
  if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }

  $warnings = New-Object System.Collections.Generic.List[string]

  # 1) 读取旧的 MachineGuid（读不到视为致命错误：无旧值则无法安全回滚）
  $oldGuid = ''
  try {
    $oldGuid = [string](Get-ItemProperty -Path $CRYPTO_KEY_PS -Name MachineGuid -ErrorAction Stop).MachineGuid
  } catch {
    throw "读取当前 MachineGuid 失败，已中止（不做任何写入）：$($_.Exception.Message)"
  }

  # 2) 计算新的 MachineGuid（优先用主进程传入；缺省则脚本内生成，标准小写无花括号）
  $newGuid = ''
  if ($NewGuid -and $NewGuid.Trim()) {
    $newGuid = $NewGuid.Trim()
  } else {
    $newGuid = [guid]::NewGuid().ToString()
  }
  if ($newGuid -notmatch $GUID_PATTERN) {
    throw "新 MachineGuid 不是合法 GUID，已中止：$newGuid"
  }
  $newGuid = $newGuid.ToLower()

  # 3) 可选：遥测 MachineId（SQMClient）。仅在显式要求且键存在时处理，缺失则告警跳过（不创建遥测键）
  $doTelemetry = [bool]$ResetTelemetryId
  $oldTelemetryId = ''
  $newTelemetryId = ''
  $telemetryReset = $false
  if ($doTelemetry) {
    $sqmExists = Test-Path -LiteralPath $SQM_KEY_PS
    if ($sqmExists) {
      try {
        $oldTelemetryId = [string](Get-ItemProperty -Path $SQM_KEY_PS -Name MachineId -ErrorAction Stop).MachineId
      } catch {
        $oldTelemetryId = ''
        $warnings.Add('未能读取当前遥测 MachineId，将仅写入新值。')
      }
      # 计算新遥测 GUID（花括号大写，符合 SQMClient 既有格式）
      $rawTel = if ($NewTelemetryId -and $NewTelemetryId.Trim()) { $NewTelemetryId.Trim() } else { [guid]::NewGuid().ToString() }
      $rawTel = $rawTel -replace '[{}]', ''
      if ($rawTel -notmatch $GUID_PATTERN) {
        throw "新遥测 MachineId 不是合法 GUID，已中止：$rawTel"
      }
      $newTelemetryId = '{' + $rawTel.ToUpper() + '}'
    } else {
      $doTelemetry = $false
      $warnings.Add('系统不存在 SQMClient\MachineId 键，已跳过遥测标识重置。')
    }
  }

  # 4) 写前备份：把将被修改的注册表值导出为单个 .reg（UTF-16 LE），可一键还原
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('Windows Registry Editor Version 5.00')
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine('[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Cryptography]')
  [void]$sb.AppendLine(('"MachineGuid"="{0}"' -f (ConvertTo-RegLiteral $oldGuid)))
  if ($doTelemetry) {
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\SQMClient]')
    [void]$sb.AppendLine(('"MachineId"="{0}"' -f (ConvertTo-RegLiteral $oldTelemetryId)))
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupPath = Join-Path $BackupDir ("machineid-backup-{0}.reg" -f $stamp)
  # reg 文件需 UTF-16 LE（带 BOM），reg import 才能正确识别
  [System.IO.File]::WriteAllText($backupPath, $sb.ToString(), [System.Text.Encoding]::Unicode)
  if (-not (Test-Path -LiteralPath $backupPath)) {
    throw '写前注册表备份失败，已中止（未执行任何写入）。'
  }

  # 5) 执行写入：先写 MachineGuid（REG_SZ）
  Set-ItemProperty -Path $CRYPTO_KEY_PS -Name MachineGuid -Value $newGuid -Type String -ErrorAction Stop

  # 6) 可选写入遥测 MachineId
  if ($doTelemetry) {
    try {
      Set-ItemProperty -Path $SQM_KEY_PS -Name MachineId -Value $newTelemetryId -Type String -ErrorAction Stop
      $telemetryReset = $true
    } catch {
      $warnings.Add("遥测 MachineId 写入失败（不影响 MachineGuid 已生效）：$($_.Exception.Message)")
    }
  }

  [ordered]@{
    oldMachineGuid  = "$oldGuid"
    newMachineGuid  = "$newGuid"
    telemetryReset  = [bool]$telemetryReset
    oldTelemetryId  = "$oldTelemetryId"
    newTelemetryId  = "$newTelemetryId"
    backupPath      = "$backupPath"
    requiresRestart = $true
    warnings        = @($warnings.ToArray())
  }
}
