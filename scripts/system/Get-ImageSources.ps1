# 列出可用系统镜像来源（只读）
#
# 入参：-ResourcesDir 离线资源根目录（主进程按开发态/打包态解析后传入，可能不存在）。
# 逻辑：
#   - 内置 LTSC：在 <ResourcesDir>\images\{win11-ltsc,win10-ltsc} 下探测 *.wim/*.esd/*.iso，
#     存在则 available=true 并带路径与大小；否则 available=false（本期离线包默认不随仓库分发）。
#   - 自定义 ISO：本期返回占位（available=false），导入与校验属 P3 写/重活，不在此实现。
# 输出结构对应 src/shared/types/reinstall.ts 的 SystemImageSource[]。

param(
  [string]$ResourcesDir = ''
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_REINSTALL' -Body {

  function New-WtImageSource {
    param($Id, $Kind, $Name, [bool]$Available, $Path, $Size, $Version)
    [ordered]@{
      id          = $Id
      kind        = $Kind
      displayName = $Name
      available   = $Available
      path        = "$Path"
      sizeBytes   = [long]$Size
      version     = "$Version"
    }
  }

  $defs = @(
    @{ id = 'builtin-win11-ltsc'; kind = 'prebuilt-win11-ltsc'; name = 'Windows 11 企业版 LTSC 2024（内置）'; ver = 'LTSC 2024'; sub = 'win11-ltsc' },
    @{ id = 'builtin-win10-ltsc'; kind = 'prebuilt-win10-ltsc'; name = 'Windows 10 企业版 LTSC 2021（内置）'; ver = 'LTSC 2021'; sub = 'win10-ltsc' }
  )

  $sources = @()
  foreach ($d in $defs) {
    $available = $false
    $path = ''
    $size = 0
    if ($ResourcesDir -and (Test-Path $ResourcesDir)) {
      $dir = Join-Path $ResourcesDir (Join-Path 'images' $d.sub)
      if (Test-Path $dir) {
        $img = Get-ChildItem -Path $dir -Include '*.wim', '*.esd', '*.iso' -File -Recurse -ErrorAction SilentlyContinue |
          Select-Object -First 1
        if ($img) {
          $available = $true
          $path = $img.FullName
          $size = $img.Length
        }
      }
    }
    $sources += (New-WtImageSource $d.id $d.kind $d.name $available $path $size $d.ver)
  }

  # 自定义 ISO 占位：导入/校验为后续 P3 写操作
  $sources += (New-WtImageSource 'custom-iso' 'custom-iso' '导入自定义 ISO…' $false '' 0 '')

  @($sources)
}
