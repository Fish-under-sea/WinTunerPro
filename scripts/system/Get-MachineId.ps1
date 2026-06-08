# 读取机器码（只读，仅展示）
#
# 数据来源：
#   注册表 HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid（机器唯一标识）
#   whoami /user（当前用户 SID，取其机器/域 SID 部分，即去掉末尾 RID）
# 输出结构对应 src/shared/types/reinstall.ts 的 MachineIdInfo。
#
# 说明：whoami 给出的是「用户 SID」，去掉末尾 -RID 得到「机器/域 SID」，仅作展示。

. (Join-Path $PSScriptRoot '..\common\WtCommon.ps1')

Invoke-WtScript -ErrorCode 'E_REINSTALL' -Body {
  $guid = ''
  try {
    $guid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop).MachineGuid
  } catch {
    Write-WtLog -Level WARN -Message "读取 MachineGuid 失败：$($_.Exception.Message)"
  }

  $sid = ''
  try {
    $u = & whoami /user /fo csv 2>$null | ConvertFrom-Csv
    $userSid = if ($u) { "$($u.SID)" } else { '' }
    if ($userSid -match '^(S-1-5-21-\d+-\d+-\d+)-\d+$') {
      # 取机器/域 SID（去掉末尾 RID）
      $sid = $matches[1]
    } else {
      $sid = $userSid
    }
  } catch {
    Write-WtLog -Level WARN -Message "读取机器 SID 失败：$($_.Exception.Message)"
  }

  [ordered]@{
    machineSid  = "$sid"
    machineGuid = "$guid"
  }
}
