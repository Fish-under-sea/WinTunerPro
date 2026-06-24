# WinTuner Pro —— 将 Winstep Nexus 的 .wbk 备份「无 GUI」恢复到注册表（.wbk 专用薄包装）
#
# 本脚本是面向运营/手动场景的 .wbk 入口薄包装：解析/写入逻辑与 .reg 路径同源，
# 统一收敛在 _BeautifyCommon.ps1 的 Import-NexusConfigFile（按扩展名分流，不再有第二份解析代码）。
# 程序内（applyNexusUiPreset）走统一入口 Import-NexusConfig.ps1；本脚本保留是因 .wbk 默认更保守（DryRun）、
# 便于在装有 Nexus 的机器上单独核对 [DOCKS] 落点。
#
# 背景与依据（已上机/查证）：
#   - .wbk 实为 UTF-8 纯文本 INI，含 [DOCKS] / [WORKSHELF] / [SHARED] 三段。
#   - 实测：[WORKSHELF] ↔ HKCU\Software\WinSTEP2000\NeXuS；[SHARED] ↔ ...\Shared（键名/键值已比对验证）。
#   - Nexus/WorkShelf 不提供命令行静默恢复（FAQ/论坛/帮助均确认，只能 GUI 手动 Restore）。
#     故直接写注册表以「等效」恢复，避免脆弱的 GUI 自动化。
#   - 所有值在 Nexus 中均以 REG_SZ 字符串存储（实测），故统一写 String 类型。
#
# ⚠ 需上机验证（务必在装有 Nexus 的机器上跑通后再去掉 -DryRun 默认值）：
#   - [DOCKS] 段（DockName1 / 1Label0 / 1Path0 ...）在调研机的 NeXuS 键下「未出现」，
#     本脚本默认把 [DOCKS] 写入 NeXuS 子键，但该映射尚未 100% 证实 → 用 -DryRun 先核对
#     GUI 恢复后的注册表差异再定稿（映射表见 _BeautifyCommon.ps1 的 $NexusSectionToSubKey）。
#   - .wbk 仅按「绝对路径」引用主题位图（C:\Users\Public\Documents\WinStep\Themes\...）与
#     快捷方式（*.lnk），不内嵌资源 → 需配合 Deploy-NexusResources.ps1 将资源铺到相同绝对路径。

param(
  [Parameter(Mandatory)][string]$BackupFile,          # 预置 .wbk（UTF-8 INI）
  [Parameter(Mandatory)][string]$BackupDir,           # WinTunerPro 备份目录（写前快照落此）
  [switch]$DryRun = $true                             # 默认只输出将写入的内容，不落盘
)

. (Join-Path $PSScriptRoot '_BeautifyCommon.ps1')

try {
  $ext = [System.IO.Path]::GetExtension($BackupFile).ToLower()
  if ($ext -ne '.wbk') {
    Write-WtResult -Ok $false -Code 'ERR_IMPORT_NEXUS_BACKUP' -Message "本脚本仅处理 .wbk 备份，收到：$ext（.reg 请走 Import-NexusConfig.ps1）。"
    exit 1
  }

  if ($DryRun) {
    Write-WtProgress -Percent 5 -Stage '预演解析 Nexus 备份文件（不写入）'
  }
  else {
    Write-WtProgress -Percent 5 -Stage '解析并恢复 Nexus 备份'
  }

  $imp = Import-NexusConfigFile -ConfigSource $BackupFile -BackupDir $BackupDir -DryRun:$DryRun

  if (-not $imp.dryRun) {
    Write-WtProgress -Percent 90 -Stage '重启 Nexus 应用配置'
    Restart-NexusProcess | Out-Null
  }

  Write-WtProgress -Percent 100 -Stage ($(if ($imp.dryRun) { '预演完成（未写注册表）' } else { 'Nexus 配置恢复完成' }))
  Write-WtResult -Ok $true -Data ([ordered]@{
      backupFile            = $BackupFile
      format                = [string]$imp.format
      dryRun                = [bool]$imp.dryRun
      configImported        = [bool]$imp.configImported
      backup                = [string]$imp.backup
      writtenCount          = $imp.writtenCount
      plannedCount          = $imp.plannedCount
      skippedShortcutCount  = $imp.skippedShortcutCount
      sections              = $imp.sections
      sample                = $imp.sample
      skippedShortcutSample = $imp.skippedShortcutSample
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_IMPORT_NEXUS_BACKUP' -Message $_.Exception.Message
  exit 1
}
