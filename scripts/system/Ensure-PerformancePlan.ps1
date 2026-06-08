# 确保性能电源计划存在（默认卓越性能）。
#
# 输出：{ guid, name }

param(
  [ValidateSet('high', 'ultimate')][string]$Level = 'ultimate'
)

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_POWER' -Body {
  $highPerfGuid = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
  $ultimateBaseGuid = 'e9a42b02-d5df-448d-aa00-03f14749eb61'
  $guidPattern = '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'

  $listRaw = & powercfg /list 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "powercfg /list 执行失败（退出码 $LASTEXITCODE）：$listRaw"
  }

  $plans = @()
  foreach ($line in $listRaw) {
    $m = [regex]::Match([string]$line, "$guidPattern\s*\((.+?)\)")
    if ($m.Success) {
      $plans += [ordered]@{
        guid = $m.Groups[1].Value
        name = $m.Groups[2].Value.Trim()
      }
    }
  }

  $findByGuid = {
    param([string]$Guid)
    return $plans | Where-Object { $_.guid.ToLower() -eq $Guid.ToLower() } | Select-Object -First 1
  }

  $findByName = {
    param([string[]]$Keywords)
    return $plans | Where-Object {
      $name = $_.name.ToLower()
      ($Keywords | Where-Object { $name.Contains($_) }).Count -gt 0
    } | Select-Object -First 1
  }

  $target = $null
  if ($Level -eq 'high') {
    $target = & $findByName @('高性能', 'high performance')
    if (-not $target) { $target = & $findByGuid $highPerfGuid }
    if (-not $target) {
      throw '系统中未找到高性能电源计划'
    }
  } else {
    $target = & $findByName @('卓越性能', 'ultimate performance')
    if (-not $target) { $target = & $findByGuid $ultimateBaseGuid }
    if (-not $target) {
      # 卓越性能默认隐藏，按官方 GUID 复制后会得到新的实际 GUID。
      $dupRaw = & powercfg -duplicatescheme $ultimateBaseGuid 2>&1
      if ($LASTEXITCODE -ne 0) {
        throw "创建卓越性能计划失败（退出码 $LASTEXITCODE）：$dupRaw"
      }
      $text = [string]($dupRaw -join ' ')
      $dm = [regex]::Match($text, $guidPattern)
      if (-not $dm.Success) {
        throw "创建卓越性能后未能解析 GUID：$text"
      }
      $newGuid = $dm.Groups[1].Value
      $target = [ordered]@{ guid = $newGuid; name = '卓越性能' }
    }
  }

  [ordered]@{
    guid = $target.guid
    name = $target.name
  }
}
