# WinTuner Pro —— 检测美化工具安装/运行状态（只读）
#
# 检测 TranslucentTB（任务栏透明）与 Winstep Nexus（Dock）：
#   - TranslucentTB：Store/MSIX 版，优先按 Appx 包名匹配，回退卸载项；进程名 TranslucentTB。
#   - Nexus：Inno Setup 安装，按卸载项 + 已知安装目录判断；进程名 Nexus。
# 当前风格包 id 由主进程从应用配置读取，不在本脚本范围内。

param()

. (Join-Path $PSScriptRoot '_BeautifyCommon.ps1')

try {
  $ttb = Get-ToolStatus `
    -ProcessNames @('TranslucentTB') `
    -DisplayNameLike 'TranslucentTB' `
    -AppxLike '*TranslucentTB*' `
    -KnownPaths @()

  $nexus = Get-ToolStatus `
    -ProcessNames @('Nexus') `
    -DisplayNameLike 'Nexus' `
    -AppxLike '' `
    -KnownPaths @(
      (Join-Path $env:ProgramFiles 'Winstep\Nexus.exe'),
      (Join-Path ${env:ProgramFiles(x86)} 'Winstep\Nexus.exe')
    )

  Write-WtResult -Ok $true -Data ([ordered]@{
      translucenttb = $ttb
      nexus         = $nexus
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_BEAUTIFY_STATUS' -Message $_.Exception.Message
  exit 1
}
