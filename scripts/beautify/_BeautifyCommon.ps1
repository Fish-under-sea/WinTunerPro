# WinTuner Pro —— beautify 模块公共函数
#
# 说明：本目录自带公共逻辑（结构化输出、文件/注册表备份、工具状态检测），
# 以避免与 scripts/common（由另一并行代理负责）产生文件冲突。
# 所有脚本统一以单行 JSON 对象输出：
#   成功： {"ok":true,"data":{...}}
#   失败： {"ok":false,"code":"ERR_XXX","message":"..."}

$ErrorActionPreference = 'Stop'

function Write-WtResult {
  param(
    [Parameter(Mandatory)][bool]$Ok,
    $Data = $null,
    [string]$Code = '',
    [string]$Message = ''
  )
  $obj = [ordered]@{ ok = $Ok }
  if ($Ok) {
    $obj.data = $Data
  }
  else {
    $obj.code = $Code
    $obj.message = $Message
  }
  $obj | ConvertTo-Json -Depth 8 -Compress
}

# 写注册表前调用：导出指定键到 .reg；键不存在返回空字符串。
function Backup-RegistryKeyToFile {
  param(
    [Parameter(Mandatory)][string]$RegPath,
    [Parameter(Mandatory)][string]$BackupDir,
    [Parameter(Mandatory)][string]$Tag
  )
  if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }
  reg query "$RegPath" 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { return '' }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $file = Join-Path $BackupDir ("{0}-{1}.reg" -f $Tag, $stamp)
  reg export "$RegPath" "$file" /y 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw "注册表备份失败：$RegPath" }
  return $file
}

# 覆盖文件前调用：把目标文件复制到 backups 目录，返回备份路径；不存在返回空。
function Backup-FileToDir {
  param(
    [Parameter(Mandatory)][string]$File,
    [Parameter(Mandatory)][string]$BackupDir,
    [Parameter(Mandatory)][string]$Tag
  )
  if (-not (Test-Path -LiteralPath $File)) { return '' }
  if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $ext = [System.IO.Path]::GetExtension($File)
  $dest = Join-Path $BackupDir ("{0}-{1}{2}" -f $Tag, $stamp, $ext)
  Copy-Item -LiteralPath $File -Destination $dest -Force
  return $dest
}

# 在三处 Uninstall 注册表根下，按 DisplayName 模糊匹配卸载项。
function Get-UninstallEntry {
  param([Parameter(Mandatory)][string]$Like)
  $roots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($r in $roots) {
    $e = Get-ItemProperty $r -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like "*$Like*" } |
      Select-Object -First 1
    if ($e) { return $e }
  }
  return $null
}

# 综合判定一个美化工具的安装/运行状态。
# 判定顺序：MSIX 包 → 卸载项 → 已知安装路径；运行状态用进程名。
function Get-ToolStatus {
  param(
    [string[]]$ProcessNames = @(),
    [string]$DisplayNameLike = '',
    [string]$AppxLike = '',
    [string[]]$KnownPaths = @()
  )
  $installed = $false
  $version = ''
  $running = $false

  if ($ProcessNames.Count -gt 0) {
    $p = Get-Process -Name $ProcessNames -ErrorAction SilentlyContinue
    if ($p) { $running = $true }
  }

  if (-not [string]::IsNullOrWhiteSpace($AppxLike)) {
    $pkg = Get-AppxPackage -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like $AppxLike } |
      Select-Object -First 1
    if ($pkg) {
      $installed = $true
      $version = [string]$pkg.Version
    }
  }

  if (-not $installed -and -not [string]::IsNullOrWhiteSpace($DisplayNameLike)) {
    $e = Get-UninstallEntry -Like $DisplayNameLike
    if ($e) {
      $installed = $true
      if ($e.DisplayVersion) { $version = [string]$e.DisplayVersion }
    }
  }

  if (-not $installed -and $KnownPaths.Count -gt 0) {
    foreach ($kp in $KnownPaths) {
      if (-not [string]::IsNullOrWhiteSpace($kp) -and (Test-Path -LiteralPath $kp)) {
        $installed = $true
        try { $version = [string](Get-Item -LiteralPath $kp).VersionInfo.ProductVersion } catch { }
        break
      }
    }
  }

  return [ordered]@{
    installed = $installed
    version   = $version
    running   = $running
  }
}

# 把预置 settings.json 导入 TranslucentTB 配置位置（MSIX/Store 版固定路径），
# 覆盖前先备份已有配置。返回目标路径与备份路径。
function Import-TtbConfigFile {
  param(
    [Parameter(Mandatory)][string]$ConfigSource,
    [Parameter(Mandatory)][string]$BackupDir
  )
  if (-not (Test-Path -LiteralPath $ConfigSource -PathType Leaf)) {
    throw "TranslucentTB 预置配置不存在：$ConfigSource"
  }
  # MSIX/Store 版配置固定位于该包的 RoamingState 下（见官方 config 文档）
  $target = Join-Path $env:LOCALAPPDATA 'Packages\28017CharlesMilette.TranslucentTB_v826wp6bftszj\RoamingState\settings.json'
  $dir = Split-Path $target -Parent
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $backup = Backup-FileToDir -File $target -BackupDir $BackupDir -Tag 'translucenttb-settings'
  Copy-Item -LiteralPath $ConfigSource -Destination $target -Force
  return [ordered]@{ target = $target; backup = $backup }
}
