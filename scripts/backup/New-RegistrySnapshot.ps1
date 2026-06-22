# WinTuner Pro —— 创建注册表配置快照（写：仅导出，不修改系统）
#
# 把「应用会改动的用户级注册表键」导出为单个 .reg 文件，落在 -BackupDir。
# 仅导出 HKCU 下与本工具相关的外观/资源管理器/自动播放/Nexus 等键，低风险、可一键还原。
# 不存在的键自动跳过并计入告警。输出结构经 WtCommon 信封返回，供主进程解析。

param(
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [string]$Name = '手动配置快照'
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

# 需要纳入快照的用户级注册表键（与 optimization / beautify / wallpaper 写入点对应）
$SNAPSHOT_KEYS = @(
  'HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced',
  'HKCU\Control Panel\Desktop',
  'HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers',
  'HKCU\Software\WinSTEP2000'
)

function Test-RegKeyExists {
  param([string]$RegPath)
  reg query "$RegPath" 1>$null 2>$null
  return ($LASTEXITCODE -eq 0)
}

# 把单个键导出到临时 .reg，返回临时文件路径（失败抛异常）
function Export-RegKeyToTemp {
  param([string]$RegPath)
  $tmp = Join-Path $env:TEMP ("wtp-snap-{0}.reg" -f ([guid]::NewGuid().ToString('N')))
  reg export "$RegPath" "$tmp" /y 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw "导出注册表键失败：$RegPath" }
  return $tmp
}

Invoke-WtScript -ErrorCode 'E_BACKUP' -Body {
  if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }

  $warnings = New-Object System.Collections.Generic.List[string]
  $exported = New-Object System.Collections.Generic.List[string]
  $tempFiles = New-Object System.Collections.Generic.List[string]

  foreach ($key in $SNAPSHOT_KEYS) {
    if (-not (Test-RegKeyExists -RegPath $key)) {
      $warnings.Add("跳过不存在的键：$key")
      continue
    }
    try {
      $tmp = Export-RegKeyToTemp -RegPath $key
      $tempFiles.Add($tmp)
      $exported.Add($key)
    } catch {
      $warnings.Add("导出失败：$key（$($_.Exception.Message)）")
    }
  }

  if ($exported.Count -eq 0) {
    throw '没有可导出的注册表键（目标键均不存在）'
  }

  # 合并多个导出文件为一个 .reg：保留第一个文件的版本头，其余仅追加键块
  $sb = New-Object System.Text.StringBuilder
  $isFirst = $true
  foreach ($tf in $tempFiles) {
    $raw = Get-Content -LiteralPath $tf -Raw
    if ($isFirst) {
      [void]$sb.Append($raw.TrimEnd())
      $isFirst = $false
    } else {
      # 去掉首行版本头（Windows Registry Editor Version 5.00）后追加
      $idx = $raw.IndexOf("`n")
      $body = if ($idx -ge 0) { $raw.Substring($idx + 1) } else { '' }
      [void]$sb.Append("`r`n`r`n")
      [void]$sb.Append($body.Trim())
    }
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $file = Join-Path $BackupDir ("regsnapshot-{0}.reg" -f $stamp)
  # reg 文件需 UTF-16 LE 编码，reg import 才能正确识别
  [System.IO.File]::WriteAllText($file, $sb.ToString(), [System.Text.Encoding]::Unicode)

  foreach ($tf in $tempFiles) {
    Remove-Item -LiteralPath $tf -Force -ErrorAction SilentlyContinue
  }

  $size = (Get-Item -LiteralPath $file).Length
  [ordered]@{
    file         = $file
    sizeBytes    = [long]$size
    name         = $Name
    exportedKeys = @($exported.ToArray())
    warnings     = @($warnings.ToArray())
  }
}
