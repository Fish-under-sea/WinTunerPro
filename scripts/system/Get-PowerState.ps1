# 读取电源计划列表与可改性（只读）
#
# 数据来源：powercfg /list（全部计划 GUID/名称/是否活动）+ powercfg /getactivescheme（活动计划）
# GUID 解析与本地化无关（名称本地化但 GUID 固定），中文名走 UTF-8 输出。
# 输出结构对应 src/shared/types/power.ts 的 PowerState。

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_POWER' -Body {
  $guidPattern = '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'

  $listRaw = & powercfg /list 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "powercfg /list 执行失败（退出码 $LASTEXITCODE）：$listRaw"
  }

  $plans = @()
  foreach ($line in $listRaw) {
    # 形如：电源方案 GUID: 381b4222-...df2e  (平衡) *
    $m = [regex]::Match([string]$line, "$guidPattern\s*\((.+?)\)(\s*\*)?")
    if ($m.Success) {
      $plans += [ordered]@{
        guid     = $m.Groups[1].Value
        name     = $m.Groups[2].Value.Trim()
        isActive = $false
      }
    }
  }

  # 活动计划
  $activeRaw = & powercfg /getactivescheme 2>&1
  $activeGuid = ''
  $am = [regex]::Match([string]($activeRaw -join ' '), $guidPattern)
  if ($am.Success) { $activeGuid = $am.Groups[1].Value }

  # 同步 isActive 标记（以 /getactivescheme 为准，比解析 * 更可靠）
  foreach ($p in $plans) {
    $p.isActive = ($p.guid.ToLower() -eq $activeGuid.ToLower())
  }

  # canModify：能列出计划且能取到活动计划即视为可改；组策略锁定时通常二者会异常
  $canModify = ((@($plans).Count -gt 0) -and ($activeGuid -ne ''))

  [ordered]@{
    plans      = @($plans)
    activeGuid = $activeGuid
    canModify  = [bool]$canModify
  }
}
