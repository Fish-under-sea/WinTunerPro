# Get-NvidiaProfileStatus.ps1 — 只读查询 NVIDIA 控制面板四项设置的当前注册表值

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_NV_STATUS' -Body {
  function Grv { param($p,$n,$d=$null)
    try{(Get-ItemProperty $p -Name $n -EA Stop).$n}catch{$d} }

  $hkcuNv  = 'HKCU:\Software\NVIDIA Corporation\Global\NVTweak'
  $hkcuGL  = 'HKCU:\Software\NVIDIA Corporation\Global\OpenGL'
  $hklmNv  = 'HKLM:\SYSTEM\CurrentControlSet\Services\nvlddmkm\Global\NVTweak'

  [ordered]@{
    imageSettingsMode    = [int](Grv $hkcuNv 'ImageSettingsMode'    -1)
    imageSettingsValue   = [int](Grv $hkcuNv 'ImageSettingsValue'   -1)
    openGLGpu            = [string](Grv $hkcuGL 'Gpu'               '')
    powerMizerLevel      = [int](Grv $hklmNv 'PowerMizerLevel'      -1)
    preferredRefreshRate = [int](Grv $hkcuNv 'PreferredRefreshRate' -1)
    targetImageMode      = 2
    targetImageValue     = 0
    targetPowerLevel     = 1
    targetRefreshRate    = 1
  }
}
