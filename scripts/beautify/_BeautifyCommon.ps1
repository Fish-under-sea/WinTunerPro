# WinTuner Pro —— beautify 模块公共函数
#
# 说明：本目录自带公共逻辑（结构化输出、文件/注册表备份、工具状态检测），
# 以避免与 scripts/common（由另一并行代理负责）产生文件冲突。
# 所有脚本统一以单行 JSON 对象输出：
#   成功： {"ok":true,"data":{...}}
#   失败： {"ok":false,"code":"ERR_XXX","message":"..."}

$ErrorActionPreference = 'Stop'

# 统一以 UTF-8 输出，保证进度文案（含中文）经管道被主进程正确解码（PS 5.1 默认编码会乱码）。
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch { }

# 输出单行进度：WT_PROGRESS:{json}。主进程按行实时解析（见 beautifyService.runScriptStreaming）。
# 注意：与最终的 Write-WtResult（同样输出单行 JSON）区分——进度行带 WT_PROGRESS: 前缀，
# 不以 { 开头，因此不会被结果解析逻辑（取最后一个以 { 开头的可解析 JSON）误判。
function Write-WtProgress {
  param(
    [Parameter(Mandatory)][int]$Percent,
    [Parameter(Mandatory)][string]$Stage
  )
  $obj = [ordered]@{ percent = $Percent; stage = $Stage }
  'WT_PROGRESS:' + ($obj | ConvertTo-Json -Compress)
}

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

# 写注册表前调用：导出指定键到 .reg；键不存在返回空字符串。
function Backup-RegistryKeyToFile {
  param(
    [Parameter(Mandatory)][string]$RegPath,
    [Parameter(Mandatory)][string]$BackupDir,
    [Parameter(Mandatory)][string]$Tag
  )
  if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }
  reg query "$RegPath" 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { return '' }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $file = Join-Path $BackupDir ("{0}-{1}.reg" -f $Tag, $stamp)
  reg export "$RegPath" "$file" /y 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) { throw "注册表备份失败：$RegPath" }
  return $file
}

# 覆盖文件前调用：把目标文件复制到 backups 目录，返回备份路径；不存在返回空。
function Backup-FileToDir {
  param(
    [Parameter(Mandatory)][string]$File,
    [Parameter(Mandatory)][string]$BackupDir,
    [Parameter(Mandatory)][string]$Tag
  )
  if (-not (Test-Path -LiteralPath $File)) { return '' }
  if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $ext = [System.IO.Path]::GetExtension($File)
  $dest = Join-Path $BackupDir ("{0}-{1}{2}" -f $Tag, $stamp, $ext)
  Copy-Item -LiteralPath $File -Destination $dest -Force
  return $dest
}

# 在三处 Uninstall 注册表根下，按 DisplayName 模糊匹配卸载项。
function Get-UninstallEntry {
  param([Parameter(Mandatory)][string]$Like)
  $roots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($r in $roots) {
    $e = Get-ItemProperty $r -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -like "*$Like*" } |
      Select-Object -First 1
    if ($e) { return $e }
  }
  return $null
}

# 综合判定一个美化工具的安装/运行状态。
# 判定顺序：MSIX 包 → 卸载项 → 已知安装路径；运行状态用进程名。
function Get-ToolStatus {
  param(
    [string[]]$ProcessNames = @(),
    [string]$DisplayNameLike = '',
    [string]$AppxLike = '',
    [string[]]$KnownPaths = @()
  )
  $installed = $false
  $version = ''
  $running = $false

  if ($ProcessNames.Count -gt 0) {
    $p = Get-Process -Name $ProcessNames -ErrorAction SilentlyContinue
    if ($p) { $running = $true }
  }

  if (-not [string]::IsNullOrWhiteSpace($AppxLike)) {
    $pkg = Get-AppxPackage -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like $AppxLike } |
      Select-Object -First 1
    if ($pkg) {
      $installed = $true
      $version = [string]$pkg.Version
    }
  }

  if (-not $installed -and -not [string]::IsNullOrWhiteSpace($DisplayNameLike)) {
    $e = Get-UninstallEntry -Like $DisplayNameLike
    if ($e) {
      $installed = $true
      if ($e.DisplayVersion) { $version = [string]$e.DisplayVersion }
    }
  }

  if (-not $installed -and $KnownPaths.Count -gt 0) {
    foreach ($kp in $KnownPaths) {
      if (-not [string]::IsNullOrWhiteSpace($kp) -and (Test-Path -LiteralPath $kp)) {
        $installed = $true
        try { $version = [string](Get-Item -LiteralPath $kp).VersionInfo.ProductVersion } catch { }
        break
      }
    }
  }

  return [ordered]@{
    installed = $installed
    version   = $version
    running   = $running
  }
}

# 把预置 settings.json 导入 TranslucentTB 配置位置（MSIX/Store 版固定路径），
# 覆盖前先备份已有配置。返回目标路径与备份路径。
function Import-TtbConfigFile {
  param(
    [Parameter(Mandatory)][string]$ConfigSource,
    [Parameter(Mandatory)][string]$BackupDir
  )
  if (-not (Test-Path -LiteralPath $ConfigSource -PathType Leaf)) {
    throw "TranslucentTB 预置配置不存在：$ConfigSource"
  }
  # MSIX/Store 版配置固定位于该包的 RoamingState 下（见官方 config 文档）
  $target = Join-Path $env:LOCALAPPDATA 'Packages\28017CharlesMilette.TranslucentTB_v826wp6bftszj\RoamingState\settings.json'
  $dir = Split-Path $target -Parent
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $backup = Backup-FileToDir -File $target -BackupDir $BackupDir -Tag 'translucenttb-settings'
  Copy-Item -LiteralPath $ConfigSource -Destination $target -Force
  return [ordered]@{ target = $target; backup = $backup }
}

# 更稳健地导入 .reg：先直接 reg import，失败时尝试转 UTF-16 再导入（兼容 UTF-8 源文件）。
function Import-RegistryFileRobust {
  param(
    [Parameter(Mandatory)][string]$ConfigSource
  )
  if (-not (Test-Path -LiteralPath $ConfigSource -PathType Leaf)) {
    throw "注册表配置不存在：$ConfigSource"
  }

  reg import "$ConfigSource" 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) {
    return [ordered]@{ fallbackUsed = $false }
  }

  $tmp = Join-Path $env:TEMP ("wtp-reg-import-{0}.reg" -f ([guid]::NewGuid().ToString('N')))
  try {
    $raw = Get-Content -LiteralPath $ConfigSource -Raw -Encoding UTF8
    [System.IO.File]::WriteAllText($tmp, $raw, [System.Text.Encoding]::Unicode)
    reg import "$tmp" 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
      throw "reg import 返回退出码：$LASTEXITCODE"
    }
    return [ordered]@{ fallbackUsed = $true }
  }
  finally {
    if (Test-Path -LiteralPath $tmp) {
      Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
  }
}

# Nexus 已知可执行路径（不同安装器可能写到 Program Files 或 Program Files (x86)）。
function Get-NexusExecutablePath {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Winstep\Nexus.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Winstep\Nexus.exe'),
    (Join-Path $env:ProgramFiles 'Winstep\Nexus\Nexus.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Winstep\Nexus\Nexus.exe')
  )
  foreach ($c in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($c) -and (Test-Path -LiteralPath $c)) {
      return $c
    }
  }
  return ''
}

# Nexus 安装验真：卸载项或已知可执行路径任一命中即视为已安装。
function Test-NexusInstalled {
  $entry = Get-UninstallEntry -Like 'Nexus'
  if ($entry) { return $true }
  return -not [string]::IsNullOrWhiteSpace((Get-NexusExecutablePath))
}

# Nexus 注册表根（本机实测键名，旧文档写 Winstep 为误）。
$NexusRegRoot = 'HKCU\Software\WinSTEP2000'

# .wbk 段名 → 注册表子键 的映射（数据契约，必须与 src/shared/types/beautify.ts 的
# NEXUS_WBK_SECTION_TO_SUBKEY 保持一致）。
#   - WORKSHELF ↔ NeXuS、SHARED ↔ Shared：已上机比对验证。
#   - DOCKS ↔ NeXuS：⚠ 尚未上机验证 → .wbk 导入默认 DryRun（见 Import-NexusConfigFile）。
$NexusSectionToSubKey = [ordered]@{
  'WORKSHELF' = 'NeXuS'
  'SHARED'    = 'Shared'
  'DOCKS'     = 'NeXuS'   # ⚠ 待上机验证
}

# 解析 Nexus .wbk（实为 UTF-8 纯文本 INI，含 [DOCKS]/[WORKSHELF]/[SHARED] 段）。
# 返回 [ordered]@{ 段名 = [ordered]@{ key = value } }。值可能含 '='，按首个 '=' 切分。
function Read-NexusBackupIni {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "备份文件不存在：$Path"
  }
  $result = [ordered]@{}
  $current = $null
  foreach ($line in (Get-Content -LiteralPath $Path -Encoding UTF8)) {
    if ($line -match '^\s*\[(.+?)\]\s*$') {
      $current = $Matches[1]
      if (-not $result.Contains($current)) { $result[$current] = [ordered]@{} }
      continue
    }
    if ($null -eq $current) { continue }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { continue }
    $k = $line.Substring(0, $idx)
    $v = $line.Substring($idx + 1)
    $result[$current][$k] = $v
  }
  return $result
}

# 判定一个 .wbk 键名是否为「快捷方式 / Dock 图标条目项」（应跳过，不写入注册表）。
# 规则与 TS 契约层 isNexusShortcutKey（src/shared/types/beautify.ts）保持一致：
#   - 依据真实 wsbackup.wbk：[DOCKS] 段每个图标条目以 <dock序号><字段><条目序号> 命名
#     （1Label0 / 1Path0=...\xx.lnk / 1StartPath0 / 1Type0 / 1Hotkey2），全部「以数字开头」；
#     UI/外观键一律「以字母开头」（DockIconSize1 / DockFxEffect1 / NeXuSThemeName ...）。
#   1. 以数字开头 → 快捷方式条目（跳过）。
#   2. DockNoItems<n>（条目计数）→ 也跳过：用户要求不动本机快捷方式，只写计数不写条目会不一致。
# 保守原则：宁可多跳过疑似快捷方式项，也不要误写覆盖用户本机快捷方式。
function Test-NexusShortcutKey {
  param([Parameter(Mandatory)][string]$Name)
  if ($Name -match '^\d') { return $true }
  if ($Name -match '^DockNoItems\d+$') { return $true }
  return $false
}

# 由已解析的 INI 段映射出注册表写入计划（纯逻辑：段→子键映射 + 平铺键值）。
# 过滤掉「快捷方式 / Dock 图标条目项」（见 Test-NexusShortcutKey）——只对齐 UI 设置。
# 返回 [ordered]@{ plan; skippedCount; skipped }：
#   - plan         ：List[object]，每项 = @{ subKey; regPath; name; value }（仅 UI 设置）。
#   - skippedCount ：被跳过的快捷方式项数。
#   - skipped      ：被跳过键名样例（截断展示，便于核对）。
# 未在段→子键映射表中的段被忽略。
function Get-NexusBackupRegPlan {
  param([Parameter(Mandatory)]$Ini)
  $plan = New-Object System.Collections.Generic.List[object]
  $skipped = New-Object System.Collections.Generic.List[string]
  foreach ($section in $Ini.Keys) {
    if (-not $NexusSectionToSubKey.Contains($section)) { continue }
    $subKey = $NexusSectionToSubKey[$section]
    foreach ($k in $Ini[$section].Keys) {
      if (Test-NexusShortcutKey -Name $k) {
        $skipped.Add($k)
        continue
      }
      $plan.Add([ordered]@{
          subKey  = $subKey
          regPath = "$NexusRegRoot\$subKey"
          name    = $k
          value   = $Ini[$section][$k]
        })
    }
  }
  return [ordered]@{
    plan         = $plan
    skippedCount = $skipped.Count
    skipped      = @($skipped | Select-Object -First 20)
  }
}

# 导入 Nexus 预置配置的「停-备-导」核心逻辑（同源底层），供安装脚本与两个解耦导入脚本共用。
# 按 ConfigSource 扩展名分流（仅此一步不同，骨架与备份/回滚保持一致）：
#   - .reg：停 Nexus → 备份 HKCU\Software\WinSTEP2000 → 稳健 reg import。
#   - .wbk：解析 INI → 段映射成注册表计划；DryRun（默认建议）仅返回计划不落盘；
#           真实写入时 停 Nexus → 备份整树 → 逐项写 String 值。
# 仅负责导入，不负责重启（重启交由 Restart-NexusProcess，便于调用方按场景控制进度文案/告警）。
# ⚠ .wbk 的 [DOCKS] 段落点（HKCU\Software\WinSTEP2000\NeXuS）尚未上机验证，调用方应默认 -DryRun，
#   在装有 Nexus 的机器上 GUI 恢复一次后 diff 注册表确认无误，再去掉 DryRun 真实写入。
# 返回 [ordered]@{ format; dryRun; configImported; backup; fallbackUsed; writtenCount; plannedCount; sections; sample }。
function Import-NexusConfigFile {
  param(
    [Parameter(Mandatory)][string]$ConfigSource,
    [Parameter(Mandatory)][string]$BackupDir,
    [switch]$DryRun
  )
  if (-not (Test-Path -LiteralPath $ConfigSource -PathType Leaf)) {
    throw "Nexus 预置配置不存在：$ConfigSource"
  }
  $ext = [System.IO.Path]::GetExtension($ConfigSource).ToLower()

  switch ($ext) {
    '.reg' {
      # DryRun 对 .reg 无实际预览价值（reg import 是原子操作），仅作安全短路：不导入、不备份。
      if ($DryRun) {
        return [ordered]@{
          format = 'reg'; dryRun = $true; configImported = $false
          backup = ''; fallbackUsed = $false
        }
      }
      # 导入前关闭 Nexus，避免运行中进程把内存里的旧配置回写、覆盖刚导入的注册表值。
      Stop-Process -Name 'Nexus' -Force -ErrorAction SilentlyContinue
      $backup = Backup-RegistryKeyToFile -RegPath $NexusRegRoot -BackupDir $BackupDir -Tag 'nexus-winstep2000'
      $importResult = Import-RegistryFileRobust -ConfigSource $ConfigSource
      return [ordered]@{
        format         = 'reg'
        dryRun         = $false
        configImported = $true
        backup         = $backup
        fallbackUsed   = [bool]$importResult.fallbackUsed
      }
    }
    '.wbk' {
      $ini = Read-NexusBackupIni -Path $ConfigSource
      # 计划已过滤掉「快捷方式 / Dock 图标条目项」，仅保留 UI 设置（见 Get-NexusBackupRegPlan）。
      $planResult = Get-NexusBackupRegPlan -Ini $ini
      $plan = $planResult.plan
      $skippedShortcutCount = [int]$planResult.skippedCount

      if ($DryRun) {
        # ⚠ 仅预演：不停进程、不备份、不写注册表。用于 [DOCKS] 落点上机核对前的安全核验。
        return [ordered]@{
          format               = 'wbk'
          dryRun                = $true
          configImported        = $false
          backup                = ''
          fallbackUsed          = $false
          plannedCount          = $plan.Count
          skippedShortcutCount  = $skippedShortcutCount
          sections              = @($ini.Keys)
          sample                = @($plan | Select-Object -First 10)
          skippedShortcutSample = @($planResult.skipped)
        }
      }

      # —— 真实写入路径（调用方显式去掉 -DryRun 后）——
      Stop-Process -Name 'Nexus' -Force -ErrorAction SilentlyContinue
      # 写系统前必须备份（项目规则）：导出整个 WinSTEP2000 根，覆盖所有段。
      $backup = Backup-RegistryKeyToFile -RegPath $NexusRegRoot -BackupDir $BackupDir -Tag 'nexus-winstep2000-prerestore'
      $written = 0
      foreach ($item in $plan) {
        $psPath = 'Registry::HKEY_CURRENT_USER\Software\WinSTEP2000\' + $item.subKey
        if (-not (Test-Path -LiteralPath $psPath)) {
          New-Item -Path $psPath -Force | Out-Null
        }
        # 所有值在 Nexus 中均以 REG_SZ 字符串存储（实测），故统一写 String 类型。
        New-ItemProperty -LiteralPath $psPath -Name $item.name -Value $item.value -PropertyType String -Force | Out-Null
        $written++
      }
      return [ordered]@{
        format               = 'wbk'
        dryRun               = $false
        configImported       = $true
        backup               = $backup
        fallbackUsed         = $false
        writtenCount         = $written
        plannedCount         = $plan.Count
        skippedShortcutCount = $skippedShortcutCount
        sections             = @($ini.Keys)
      }
    }
    default {
      throw "不支持的 Nexus 配置类型：$ext（请提供 .reg 或 .wbk）"
    }
  }
}

# 重新拉起 Nexus.exe（已安装才有意义）。失败不抛异常，返回 $true/$false 由调用方决定是否记告警。
function Restart-NexusProcess {
  $nexusExe = Get-NexusExecutablePath
  if ([string]::IsNullOrWhiteSpace($nexusExe)) { return $false }
  try {
    Start-Process -FilePath $nexusExe -ErrorAction SilentlyContinue | Out-Null
    return $true
  }
  catch {
    return $false
  }
}
