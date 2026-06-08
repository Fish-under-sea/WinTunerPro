# WinTuner Pro —— wallpaper 模块公共函数
#
# 说明：本目录自带公共逻辑（结构化输出、注册表/文件备份），
# 以避免与 scripts/common（由另一并行代理负责）产生文件冲突。
# 所有脚本统一以单行 JSON 对象输出，便于主进程解析：
#   成功： {"ok":true,"data":{...}}
#   失败： {"ok":false,"code":"ERR_XXX","message":"..."}

$ErrorActionPreference = 'Stop'

# 统一输出结果。-Compress 输出单行，减少换行干扰；-Depth 兜底深层结构。
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

# 写注册表前调用：将指定键导出为 .reg 到 backups 目录，返回备份文件路径。
# 键不存在（首次设置场景）时返回空字符串，不视为错误。
function Backup-RegistryKeyToFile {
  param(
    [Parameter(Mandatory)][string]$RegPath,   # 形如 HKCU\Control Panel\Desktop
    [Parameter(Mandatory)][string]$BackupDir,
    [Parameter(Mandatory)][string]$Tag        # 备份文件名标签
  )
  if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }
  # reg query 判断键是否存在；存在才导出
  reg query "$RegPath" 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { return '' }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $file = Join-Path $BackupDir ("{0}-{1}.reg" -f $Tag, $stamp)
  reg export "$RegPath" "$file" /y 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw "注册表备份失败：$RegPath" }
  return $file
}
