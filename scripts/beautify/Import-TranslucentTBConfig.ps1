# WinTuner Pro —— 导入 TranslucentTB 预置配置（写操作，供应用风格包复用）
#
# 把指定的预置 settings.json 写入 TranslucentTB（MSIX/Store 版）固定配置路径，
# 覆盖前先备份现有配置。apply-theme 在套用风格包时调用本脚本写入任务栏样式。

param(
  [Parameter(Mandatory)][string]$ConfigSource,
  [Parameter(Mandatory)][string]$BackupDir
)

. (Join-Path $PSScriptRoot '_BeautifyCommon.ps1')

try {
  $result = Import-TtbConfigFile -ConfigSource $ConfigSource -BackupDir $BackupDir
  Write-WtResult -Ok $true -Data $result
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_IMPORT_TTB_CONFIG' -Message $_.Exception.Message
  exit 1
}
