# WinTuner Pro —— 还原注册表配置快照（写：reg import）
#
# 还原流程（可回退）：
#   1. 还原前对当前同类键自动创建一份安全快照（调用 New-RegistrySnapshot.ps1），便于回退；
#   2. reg import 导入目标 .reg；首次失败时尝试转 UTF-16 再导入，兼容外部 UTF-8 文件。
# 仅接受 -File 指向的 .reg 文件，路径合法性由主进程 service 负责白名单校验。

param(
  [Parameter(Mandatory = $true)][string]$File,
  [Parameter(Mandatory = $true)][string]$BackupDir
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

# 更稳健地导入 .reg：直接 reg import，失败再转 UTF-16 重试
function Import-RegFileRobust {
  param([string]$Path)
  reg import "$Path" 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) {
    return $false
  }
  $tmp = Join-Path $env:TEMP ("wtp-restore-{0}.reg" -f ([guid]::NewGuid().ToString('N')))
  try {
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    [System.IO.File]::WriteAllText($tmp, $raw, [System.Text.Encoding]::Unicode)
    reg import "$tmp" 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) { throw "reg import 返回退出码：$LASTEXITCODE" }
    return $true
  } finally {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  }
}

Invoke-WtScript -ErrorCode 'E_BACKUP' -Body {
  if (-not (Test-Path -LiteralPath $File -PathType Leaf)) {
    throw "备份文件不存在：$File"
  }

  $warnings = New-Object System.Collections.Generic.List[string]

  # 1) 还原前安全快照（失败不阻断还原，仅告警）
  $safetyBackup = ''
  try {
    $snapScript = Join-Path $PSScriptRoot 'New-RegistrySnapshot.ps1'
    $out = & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $snapScript -BackupDir $BackupDir -Name '还原前自动快照' 2>$null
    $env = $out | Where-Object { $_ -and $_.Trim().StartsWith('{') } | Select-Object -Last 1
    if ($env) {
      $parsed = $env | ConvertFrom-Json
      if ($parsed.ok) { $safetyBackup = [string]$parsed.data.file }
    }
  } catch {
    $warnings.Add("还原前安全快照创建失败：$($_.Exception.Message)")
  }

  # 2) 导入目标快照
  $fallbackUsed = Import-RegFileRobust -Path $File
  if ($fallbackUsed) {
    $warnings.Add('检测到注册表文件编码兼容性问题，已自动转码后导入。')
  }

  [ordered]@{
    success          = $true
    safetyBackupPath = $safetyBackup
    message          = '注册表快照已还原，部分设置可能需重启资源管理器或重新登录后生效。'
    warnings         = @($warnings.ToArray())
  }
}
