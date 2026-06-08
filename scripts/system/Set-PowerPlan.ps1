# 切换激活电源计划（低风险写操作）
#
# 入参：-Guid 目标电源方案 GUID（主进程已做白名单校验，此处再次校验形态防注入）。
# 安全：切换前先记录当前活动方案 GUID（回滚依据，记入日志并随 data 返回），
#      切换后再次读取活动方案做结果校验。
# 输出结构：{ previousGuid, activeGuid }（主进程仅判定成败，返回 void）。

param(
  [Parameter(Mandatory = $true)][string]$Guid
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_POWER' -Body {
  $guidRe = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  if ($Guid -notmatch $guidRe) {
    throw "非法的电源方案 GUID（已拒绝执行）：$Guid"
  }

  # 回滚记录：先取当前活动方案
  $prev = ''
  $activeRaw = & powercfg /getactivescheme 2>&1
  $am = [regex]::Match([string]($activeRaw -join ' '), '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')
  if ($am.Success) { $prev = $am.Groups[1].Value }
  Write-WtLog "切换前活动电源方案（回滚依据）：$prev -> 目标 $Guid"

  & powercfg /setactive $Guid 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "powercfg /setactive 执行失败（退出码 $LASTEXITCODE），可能 GUID 不存在或权限不足"
  }

  # 结果校验
  $nowRaw = & powercfg /getactivescheme 2>&1
  $nm = [regex]::Match([string]($nowRaw -join ' '), '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})')
  $nowGuid = if ($nm.Success) { $nm.Groups[1].Value } else { '' }
  if ($nowGuid.ToLower() -ne $Guid.ToLower()) {
    throw "切换后校验失败：期望 $Guid，实际 $nowGuid"
  }

  [ordered]@{
    previousGuid = $prev
    activeGuid   = $nowGuid
  }
}
