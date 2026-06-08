# WinTuner Pro —— 安装 Winstep Nexus 并导入预置配置（写操作）
#
# Nexus 使用 Inno Setup 安装器，支持标准静默开关：
#   /VERYSILENT /NORESTART /SP- /SUPPRESSMSGBOXES
# 安装方式（离线纯软）：
#   - 离线包：resources/themes/nexus/ 下的安装 exe → 静默安装。
#   - 缺失 → 返回指引性错误码（Nexus 无官方 winget 包，故不做 winget 兜底）。
# 配置导入：Nexus 设置存于注册表 HKCU\Software\WinSTEP2000（本机实测键；旧文档曾写 Winstep 为误）。
# 预置配置以 .reg 形式提供（导出自该键），导入前先备份现有 HKCU\Software\WinSTEP2000，再 reg import。

param(
  [string]$InstallerPath = '',   # 离线安装 exe 路径
  [string]$ConfigSource = '',    # 预置配置（.reg），导入 HKCU\Software\WinSTEP2000
  [Parameter(Mandatory)][string]$BackupDir
)

. (Join-Path $PSScriptRoot '_BeautifyCommon.ps1')

try {
  Write-WtProgress -Percent 5 -Stage '准备安装 Nexus'

  if ([string]::IsNullOrWhiteSpace($InstallerPath) -or -not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
    Write-WtResult -Ok $false -Code 'ERR_INSTALLER_MISSING' -Message '未找到 Winstep Nexus 离线安装包。请将安装 exe 放入 resources/themes/nexus/。'
    exit 1
  }

  # Inno Setup 静默安装拿不到精细百分比，用里程碑近似（安装中 15 → 安装完成 70）
  Write-WtProgress -Percent 15 -Stage '正在静默安装（请稍候）'
  $silentArgs = @('/VERYSILENT', '/NORESTART', '/SP-', '/SUPPRESSMSGBOXES')
  $proc = Start-Process -FilePath $InstallerPath -ArgumentList $silentArgs -Wait -PassThru
  if ($proc.ExitCode -ne 0) {
    throw "Nexus 安装器返回非零退出码：$($proc.ExitCode)"
  }
  Write-WtProgress -Percent 70 -Stage '安装完成，处理配置'

  # 配置导入（可选）：.reg 文件，导入前备份现有 WinSTEP2000 注册表
  $configImported = $false
  $backup = ''
  if (-not [string]::IsNullOrWhiteSpace($ConfigSource)) {
    if (-not (Test-Path -LiteralPath $ConfigSource -PathType Leaf)) {
      throw "Nexus 预置配置不存在：$ConfigSource"
    }
    $ext = [System.IO.Path]::GetExtension($ConfigSource).ToLower()
    if ($ext -eq '.reg') {
      Write-WtProgress -Percent 85 -Stage '备份并导入预置配置'
      $backup = Backup-RegistryKeyToFile -RegPath 'HKCU\Software\WinSTEP2000' -BackupDir $BackupDir -Tag 'nexus-winstep2000'
      reg import "$ConfigSource" 1>$null 2>$null
      if ($LASTEXITCODE -ne 0) { throw 'Nexus 配置（.reg）导入失败' }
      $configImported = $true
    }
    else {
      throw "不支持的 Nexus 配置类型：$ext（请提供 .reg）"
    }
  }

  Write-WtProgress -Percent 100 -Stage 'Nexus 安装完成'
  Write-WtResult -Ok $true -Data ([ordered]@{
      installedBy    = 'offline-exe'
      configImported = $configImported
      backup         = $backup
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_INSTALL_NEXUS' -Message $_.Exception.Message
  exit 1
}
