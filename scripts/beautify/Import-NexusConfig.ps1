# WinTuner Pro —— 导入 Winstep Nexus 预置配置（统一入口，写操作，与「安装」解耦）
#
# 用途：Nexus UI 预设（applyNexusUiPreset）对齐界面设置，以及已安装态「重新应用预设」入口复用。
# 与 Install-Nexus.ps1 的区别：本脚本不安装、只导入；前置要求 Nexus 已安装。
#
# 统一两条预设来源（扩展名分流，底层同源于 _BeautifyCommon.ps1 的 Import-NexusConfigFile）：
#   - .reg：注册表导出，落点已验证、最稳 → 走 Import-RegistryFileRobust（reg import）。
#   - .wbk：Nexus 备份 INI，运营更友好 → 解析段([DOCKS]/[WORKSHELF]/[SHARED])映射到
#           HKCU\Software\WinSTEP2000 子键写入。⚠ [DOCKS] 落点尚未上机验证，故 .wbk 默认 -DryRun
#           （仅预演不落盘）；需在装有 Nexus 的机器上 GUI 恢复后 diff 注册表确认，再去掉 -DryRun。
# 骨架统一：检测已安装 → 停 Nexus → 备份整树 → 写入（按扩展名分流）→ 重启 Nexus。
# 安全：ConfigSource 由主进程拼装的受控路径（resources/themes/<themeId>/nexus.reg|.wbk）传入，
#       渲染进程不得直接传任意路径（白名单校验在主进程 service 层完成）。

param(
  [Parameter(Mandatory)][string]$ConfigSource,   # 预置配置（.reg 或 .wbk）
  [Parameter(Mandatory)][string]$BackupDir,       # WinTunerPro 备份目录（导入前注册表快照落此）
  [switch]$DryRun                                  # .wbk 建议默认开启：仅预演不写注册表
)

. (Join-Path $PSScriptRoot '_BeautifyCommon.ps1')

try {
  $warnings = New-Object System.Collections.Generic.List[string]
  Write-WtProgress -Percent 5 -Stage '检查 Nexus 安装状态'

  if (-not (Test-NexusInstalled)) {
    Write-WtResult -Ok $false -Code 'ERR_NEXUS_NOT_INSTALLED' -Message '未检测到已安装的 Winstep Nexus，请先安装 Nexus 再导入预设配置。'
    exit 1
  }

  if ($DryRun) {
    Write-WtProgress -Percent 35 -Stage '预演解析预置配置（不写入）'
  }
  else {
    Write-WtProgress -Percent 35 -Stage '备份并导入预置配置'
  }
  $imp = Import-NexusConfigFile -ConfigSource $ConfigSource -BackupDir $BackupDir -DryRun:$DryRun
  if ($imp.fallbackUsed) {
    $warnings.Add('检测到注册表文件编码兼容性问题，已自动转码后导入。')
  }

  # 仅在真实写入后才重启 Nexus（预演不改系统，无需重启）。
  if (-not $imp.dryRun) {
    Write-WtProgress -Percent 90 -Stage '重启 Nexus 应用配置'
    if (-not (Restart-NexusProcess)) {
      $warnings.Add('配置导入后自动重启 Nexus 失败，可手动启动。')
    }
  }

  Write-WtProgress -Percent 100 -Stage 'Nexus 配置导入完成'
  Write-WtResult -Ok $true -Data ([ordered]@{
      configImported       = [bool]$imp.configImported
      format               = [string]$imp.format
      dryRun               = [bool]$imp.dryRun
      backup               = [string]$imp.backup
      writtenCount         = $imp.writtenCount
      plannedCount         = $imp.plannedCount
      skippedShortcutCount = $imp.skippedShortcutCount
      sections             = $imp.sections
      warnings             = @($warnings)
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_IMPORT_NEXUS_CONFIG' -Message $_.Exception.Message
  exit 1
}
