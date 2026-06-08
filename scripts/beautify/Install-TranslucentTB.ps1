# WinTuner Pro —— 安装 TranslucentTB 并导入预置配置（写操作）
#
# 安装方式（优先「离线纯软」，winget 兜底）：
#   1. 离线包：resources/themes/translucenttb/ 下的 .msix/.msixbundle/.appx
#      → Add-AppxPackage 静默安装。
#   2. 兜底：winget install --id CharlesMilette.TranslucentTB -e --silent
#            --accept-package-agreements --accept-source-agreements（需联网且有 winget）。
#   3. 两者皆不可用 → 返回指引性错误码，不崩溃。
# 配置导入：把预置 settings.json 写入 MSIX 版固定配置路径，覆盖前先备份。

param(
  [string]$InstallerPath = '',   # 离线安装包路径（.msix/.msixbundle/.appx）
  [string]$ConfigSource = '',    # 预置 settings.json 路径
  [switch]$UseWinget,            # 离线包缺失时允许 winget 兜底
  [Parameter(Mandatory)][string]$BackupDir
)

. (Join-Path $PSScriptRoot '_BeautifyCommon.ps1')

try {
  $installedBy = ''

  if (-not [string]::IsNullOrWhiteSpace($InstallerPath) -and (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
    $ext = [System.IO.Path]::GetExtension($InstallerPath).ToLower()
    if ($ext -in @('.msix', '.msixbundle', '.appx')) {
      Add-AppxPackage -Path $InstallerPath -ErrorAction Stop
      $installedBy = 'offline-msix'
    }
    elseif ($ext -eq '.exe') {
      # 极少数便携/打包 exe，按静默约定执行
      $proc = Start-Process -FilePath $InstallerPath -ArgumentList '/S' -Wait -PassThru
      if ($proc.ExitCode -ne 0) { throw "TranslucentTB 安装器返回非零退出码：$($proc.ExitCode)" }
      $installedBy = 'offline-exe'
    }
    else {
      throw "不支持的安装包类型：$ext"
    }
  }
  elseif ($UseWinget) {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
      Write-WtResult -Ok $false -Code 'ERR_WINGET_MISSING' -Message '系统未提供 winget，无法兜底安装 TranslucentTB。请放置离线安装包到 resources/themes/translucenttb/。'
      exit 1
    }
    $args = @(
      'install', '--id', 'CharlesMilette.TranslucentTB', '-e', '--silent',
      '--accept-package-agreements', '--accept-source-agreements'
    )
    $proc = Start-Process -FilePath $winget.Source -ArgumentList $args -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0) { throw "winget 安装 TranslucentTB 失败，退出码：$($proc.ExitCode)" }
    $installedBy = 'winget'
  }
  else {
    Write-WtResult -Ok $false -Code 'ERR_INSTALLER_MISSING' -Message '未找到 TranslucentTB 离线安装包。请将 .msix 安装包放入 resources/themes/translucenttb/，或允许 winget 兜底安装。'
    exit 1
  }

  # 配置导入（可选）：有预置 settings.json 才执行
  $config = $null
  if (-not [string]::IsNullOrWhiteSpace($ConfigSource)) {
    $config = Import-TtbConfigFile -ConfigSource $ConfigSource -BackupDir $BackupDir
  }

  Write-WtResult -Ok $true -Data ([ordered]@{
      installedBy = $installedBy
      config      = $config
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_INSTALL_TRANSLUCENTTB' -Message $_.Exception.Message
  exit 1
}
