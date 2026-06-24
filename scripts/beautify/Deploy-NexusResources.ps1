# WinTuner Pro —— 铺设 Nexus 预设依赖的离线资源（写操作）
#
# 为什么需要：Nexus 的 .wbk/.reg 预设都「不自包含」，仅以绝对路径引用主题位图、图标、
# 快捷方式（如 C:\Users\Public\Documents\WinStep\Themes\<主题>\、桌面 *.lnk）。若只导入注册表，
# 恢复后这些资源不存在，图标/主题/Dock 项会缺失。本脚本把预设包内资源铺到目标绝对路径。
#
# 调用约定：主进程按 src/shared/types/beautify.ts 的 NEXUS_DEPLOY_CONVENTION 组装铺设清单，
# 把每条「源目录 → 目标目录」解析为本机绝对路径后，以 JSON 数组经 -ManifestJson 传入：
#   [ { "source": "<预设包内子目录绝对路径>", "target": "<目标绝对路径>" }, ... ]
# 渲染进程不参与路径拼接（白名单与解析在 service 层完成）。
#
# 安全（项目硬规则）：覆盖目标已存在的同名文件前先备份到 %AppData%\WinTunerPro\backups。

param(
  [Parameter(Mandatory)][string]$ManifestJson,   # 铺设清单 JSON（源/目标均为绝对路径）
  [Parameter(Mandatory)][string]$BackupDir        # 覆盖前备份落点
)

. (Join-Path $PSScriptRoot '_BeautifyCommon.ps1')

try {
  $warnings = New-Object System.Collections.Generic.List[string]
  $deployed = New-Object System.Collections.Generic.List[string]

  Write-WtProgress -Percent 5 -Stage '解析资源铺设清单'
  $manifest = @()
  if (-not [string]::IsNullOrWhiteSpace($ManifestJson)) {
    $manifest = @($ManifestJson | ConvertFrom-Json)
  }
  if ($manifest.Count -eq 0) {
    Write-WtProgress -Percent 100 -Stage '无可铺设资源'
    Write-WtResult -Ok $true -Data ([ordered]@{
        deployedCount = 0
        deployed      = @()
        backupDir     = $BackupDir
        warnings      = @('铺设清单为空，未铺设任何资源。')
      })
    exit 0
  }

  $total = $manifest.Count
  $i = 0
  foreach ($entry in $manifest) {
    $i++
    $src = [string]$entry.source
    $dst = [string]$entry.target
    $pct = [int](10 + (80 * $i / $total))
    Write-WtProgress -Percent $pct -Stage "铺设资源：$([System.IO.Path]::GetFileName($src))"

    if ([string]::IsNullOrWhiteSpace($src) -or -not (Test-Path -LiteralPath $src)) {
      $warnings.Add("源资源缺失，已跳过：$src")
      continue
    }
    if ([string]::IsNullOrWhiteSpace($dst)) {
      $warnings.Add("目标路径为空，已跳过：$src")
      continue
    }
    if (-not (Test-Path -LiteralPath $dst)) {
      New-Item -ItemType Directory -Path $dst -Force | Out-Null
    }

    # 递归铺设源目录下所有文件，保持相对结构；逐个文件覆盖前备份已存在的同名目标。
    $srcFull = (Resolve-Path -LiteralPath $src).Path.TrimEnd('\')
    foreach ($file in (Get-ChildItem -LiteralPath $srcFull -Recurse -File)) {
      $relative = $file.FullName.Substring($srcFull.Length).TrimStart('\')
      $destFile = Join-Path $dst $relative
      $destDir = Split-Path $destFile -Parent
      if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
      }
      if (Test-Path -LiteralPath $destFile -PathType Leaf) {
        Backup-FileToDir -File $destFile -BackupDir $BackupDir -Tag 'nexus-resource' | Out-Null
      }
      Copy-Item -LiteralPath $file.FullName -Destination $destFile -Force
      $deployed.Add($destFile)
    }
  }

  Write-WtProgress -Percent 100 -Stage 'Nexus 资源铺设完成'
  Write-WtResult -Ok $true -Data ([ordered]@{
      deployedCount = $deployed.Count
      deployed      = @($deployed | Select-Object -First 20)
      backupDir     = $BackupDir
      warnings      = @($warnings)
    })
}
catch {
  Write-WtResult -Ok $false -Code 'ERR_DEPLOY_NEXUS_RESOURCES' -Message $_.Exception.Message
  exit 1
}
