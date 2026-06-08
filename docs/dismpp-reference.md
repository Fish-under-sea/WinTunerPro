# DISM++ 功能调研与能力借鉴报告

> 适用项目：WinTuner Pro（Electron + React + TS + PowerShell）
> 文档性质：技术调研 / 后续脚本开发输入
> 编写日期：2026-06-08
> 调研方式：context7（Microsoft `windows-powershell-docs` 官方 DISM cmdlet 文档）+ WebSearch（DISM++ 功能机理）
>
> **重要前置**：本文所有"建议纳入"的能力，必须遵守 `project-overview.mdc` 与 `docs/security-compliance.md` 的合规底线——
> **仅做系统初始化与优化，严禁反作弊绕过 / 破解 / 规避检测；任何写系统操作前必须可备份、可回滚；面向小白、全程可视化引导。**

---

## 0. 一句话结论

DISM++ 本质是**微软原生 DISM API / 命令行的 GUI 封装**，叠加一层**注册表/服务/启动项的批量调节**与**自研清理规则（NCleaner.dll / Data.xml）**。它没有任何"黑科技"——所有能力 WinTuner Pro 都能用 `PowerShell + DISM cmdlet + 注册表` 在自己的技术栈内复刻。对本项目最有价值的可借鉴方向是：**空间回收（系统清理）**、**系统优化开关（注册表/服务）**、**驱动备份还原**、**Appx 应用清理**、**离线映像部署（重装模块）**。

---

## 1. DISM++ 功能模块概览（分类列表）

DISM++ 的 GUI 主要分三大功能组，外加一个工具箱：

### 1.1 实用工具（Utilities）
- **空间回收（核心清理）**：Windows 更新清理（WinSxS 旧组件）、临时文件、系统日志、回收站、Delivery Optimization 缓存、DirectX 着色器缓存、错误报告、各应用缓存（微信/QQ 等）、CompactOS 系统文件压缩。
- **启动项管理**：原生启动项（msconfig 等价）、计划任务、系统服务、资源管理器 Shell 扩展（右键菜单项）。
- **Appx 管理**：用户已装应用（`Get-AppxPackage`）+ 预置应用（`Get-AppxProvisionedPackage`），可批量卸载。
- **更新管理**：列出已装更新、扫描/卸载选定更新。
- **系统文件扫描 / 映像健康检查**（SFC / DISM `/CheckHealth /ScanHealth /RestoreHealth` 的图形化）。

### 1.2 控制面板（Control Panel）
- **系统优化器（System Optimizer）**：几十项"勾选即生效"的系统隐藏开关，覆盖桌面体验、资源管理器、任务栏、网络、安全/隐私（关闭 Defender、关闭遥测/客户体验改善计划、关闭自动播放等）、服务优化、日志关闭等。底层是注册表项与服务启动类型的批量修改，支持导入 `.reg`。
- **驱动管理**：列出已装第三方驱动，支持**导出（备份）/ 删除 / 添加**。
- **功能管理（Optional Features）**：启用/禁用 Windows 可选功能。
- **功能/能力卸载（FoD / Capabilities）**：卸载语言包、补充字体、图形工具等按需功能。

### 1.3 部署功能（Deployment / Image Servicing）
- **挂载/卸载映像**：挂载 WIM/ESD，修改后提交（commit）或丢弃。
- **捕获/应用映像**：捕获当前系统为映像、把 install.wim/esd 应用到分区（重装核心）。
- **组件/更新/驱动集成**：向离线映像注入更新、驱动、功能。
- **格式转换**：ESD ↔ WIM ↔ ISO。

### 1.4 工具箱（Toolbox）
- 系统备份 & 还原（WIM/ESD 整盘映像备份，PE 下还原）。
- 启动修复 / 引导管理（BCD）。
- 系统还原点管理。
- 激活信息备份（**本项目禁止纳入，见红线**）。
- God Mode 等快捷入口。

---

## 2. 能力借鉴映射表

> 风险等级：**低**=可逆、影响面小；**中**=影响系统行为、需备份；**高**=可能破坏更新/恢复/系统稳定，需强制备份+二次确认。
> 底层手段中的 cmdlet 语法均来自 Microsoft 官方 `windows-powershell-docs`（DISM 模块）。

| # | DISM++ 功能 | 对应 WinTuner Pro 模块 | 底层实现手段 | 风险 | 本期纳入 |
|---|---|---|---|---|---|
| 1 | 临时文件/日志/回收站/缓存清理 | 系统优化 | 删除 `%TEMP%`、`C:\Windows\Temp`、`SoftwareDistribution\Download`、`Clear-RecycleBin`、各日志目录 | 低 | ✅ 建议 |
| 2 | Windows 更新组件清理（WinSxS） | 系统优化 | `Repair-WindowsImage -Online -StartComponentCleanup`；命令行 `dism /online /cleanup-image /startcomponentcleanup` | 中 | ✅ 建议 |
| 3 | WinSxS 深度清理 ResetBase（不可回滚旧更新） | 系统优化（专家项） | `... -StartComponentCleanup -ResetBase`；`dism /online /cleanup-image /startcomponentcleanup /resetbase` | **高** | ⚠️ 谨慎/默认关闭 |
| 4 | 组件库占用分析（清理前评估） | 系统优化 | `dism /online /cleanup-image /analyzecomponentstore` | 低 | ✅ 建议 |
| 5 | Delivery Optimization / DirectX 着色器缓存清理 | 系统优化 | 清理 `C:\Windows\SoftwareDistribution`、`%LOCALAPPDATA%\D3DSCache` 等目录 | 低 | ✅ 建议 |
| 6 | 启动项管理（开机自启） | 系统优化 | 注册表 `HKLM/HKCU\...\Run`、启动文件夹、`Win32_StartupCommand` 查询 | 低 | ✅ 建议 |
| 7 | 服务优化（禁用非必要服务） | 系统优化 | `Get-Service` / `Set-Service -StartupType`；注册表 `HKLM\SYSTEM\CurrentControlSet\Services\*\Start` | 中 | ✅ 建议（白名单制） |
| 8 | 计划任务管理 | 系统优化 | `Get-ScheduledTask` / `Disable-ScheduledTask` | 中 | ✅ 建议 |
| 9 | 右键菜单（Shell 扩展）优化 | 系统美化/优化 | 注册表 `HKCR\*\shellex\ContextMenuHandlers` 等 | 中 | ⏳ 下期 |
| 10 | 桌面/资源管理器/任务栏体验开关（显示扩展名、小箭头、任务栏秒针等） | 系统优化/美化 | 注册表 `HKCU\...\Explorer\Advanced` 等 | 低 | ✅ 建议 |
| 11 | 隐私/遥测关闭（客户体验改善、错误报告、诊断数据） | 系统优化 | 注册表 `...\DataCollection\AllowTelemetry`、关闭 DiagTrack 等服务 | 中 | ✅ 建议（合规说明） |
| 12 | 关闭 Windows Defender | 系统优化 | 注册表/组策略 `DisableAntiSpyware`、Tamper Protection | **高** | ❌ 不建议（见红线说明） |
| 13 | 网络优化（TCP 连接数/QoS） | 系统优化（已在项目内） | `netsh int tcp set`、注册表 TCP 参数；与项目既有网络优化合并 | 中 | ✅ 建议（去重） |
| 14 | Appx 用户应用卸载 | 系统优化/初始化 | `Get-AppxPackage` + `Remove-AppxPackage` | 中 | ✅ 建议（白名单） |
| 15 | Appx 预置应用卸载（新用户不再安装） | 系统初始化 | `Get-AppxProvisionedPackage -Online` + `Remove-AppxProvisionedPackage -Online -PackageName` | 中 | ✅ 建议（白名单） |
| 16 | 驱动导出（备份） | 配置备份与迁移 / 重装 | `Export-WindowsDriver -Online -Destination <dir>` | 低 | ✅ 建议 |
| 17 | 驱动列表查看 | 配置备份与迁移 | `Get-WindowsDriver -Online -All` | 低 | ✅ 建议 |
| 18 | 驱动导入/安装 | 系统重装与初始化 | `Add-WindowsDriver -Online -Driver <inf/dir> -Recurse`；或 `pnputil /add-driver` | 中 | ✅ 建议 |
| 19 | 驱动删除 | 系统优化 | `pnputil /delete-driver`（在线）；离线 `Remove-WindowsDriver` | 中 | ⏳ 下期 |
| 20 | 可选功能启用/禁用 | 系统优化/初始化 | `Get/Enable/Disable-WindowsOptionalFeature -Online` | 中 | ✅ 建议（少量） |
| 21 | 按需功能/能力（FoD）卸载（语言包/字体等） | 系统优化 | `Get/Remove-WindowsCapability -Online` | 中 | ⏳ 下期 |
| 22 | 系统文件修复（SFC/DISM 健康检查） | 系统优化/重装 | `Repair-WindowsImage -Online -ScanHealth/-RestoreHealth`；`sfc /scannow` | 低 | ✅ 建议 |
| 23 | 注册表备份/导入 | 配置备份与迁移（已在项目内） | `reg export` / `reg import`；与项目 `.reg` 快照机制合并 | 低 | ✅ 建议（去重） |
| 24 | 系统映像备份（整盘 WIM） | 配置备份与迁移 | `New-WindowsImage` / `dism /capture-image`（需 PE 或卷影） | **高** | ⏳ 下期（复杂） |
| 25 | 应用 install.wim/esd 部署到分区（重装） | 系统重装与初始化 | `Expand-WindowsImage -ImagePath -ApplyPath -Index`；`dism /apply-image` | **高** | ⏳ P3 阶段 |
| 26 | 挂载/修改/提交离线映像 | 系统重装与初始化 | `Mount-WindowsImage` / `Dismount-WindowsImage -Save` | **高** | ⏳ P3 阶段 |
| 27 | 离线映像集成更新/驱动 | 系统重装与初始化 | 挂载后 `Add-WindowsPackage` / `Add-WindowsDriver` | **高** | ⏳ P3 阶段 |
| 28 | ESD/WIM/ISO 格式转换 | 系统重装与初始化 | `Export-WindowsImage`（WIM/ESD）；ISO 需 oscdimg | 中 | ⏳ 下期 |
| 29 | 引导修复 / BCD 管理 | 系统重装与初始化 | `bcdboot`、`bcdedit`、`bootrec` | **高** | ⏳ P3 阶段 |
| 30 | 恢复环境（WinRE）管理 | 系统重装与初始化 | `reagentc /info /enable /disable` | 高 | ⏳ 下期 |
| 31 | 系统还原点管理 | 配置备份与迁移 | `Checkpoint-Computer` / `Get-ComputerRestorePoint` | 中 | ✅ 建议（写系统前自动建点） |
| 32 | CompactOS 系统压缩 | 系统优化 | `compact /compactos:query|always|never` | 中 | ⏳ 下期 |
| 33 | 激活信息备份/迁移 | —— | —— | —— | ❌ **禁止纳入（红线）** |
| 34 | God Mode / 杂项快捷入口 | —— | 注册表/特殊文件夹 GUID | 低 | ⏳ 可选 |

---

## 3. 合规红线与高风险条目（必须遵守）

### 3.1 合规红线 —— 禁止纳入
按 `project-overview.mdc` 第 1 节"合规边界"和 `docs/security-compliance.md`：

- **激活信息备份/迁移（#33）**：涉及绕过/迁移授权，属破解/规避检测范畴，**禁止纳入**。
- **任何反作弊绕过、破解、规避检测类逻辑**：DISM++ 本身不含此类功能，但需明确——本项目不实现"游戏检测规避""驱动签名强制关闭以绕过检测"等任何变体。
- **强制关闭驱动签名校验（testsigning / nointegritychecks）**：仅在合法离线部署自有驱动的极窄场景才可能涉及，**默认禁止**，且绝不可用于规避检测目的。
- **关闭 Windows Defender（#12）**：虽属常见"优化"，但会显著降低用户安全、可能被判恶意行为，且 Tamper Protection 下需特殊手段。**本期不建议纳入**；若未来确有需求，必须独立强提示 + 用户显式授权 + 可一键恢复，并经合规复核。

### 3.2 高风险 —— 必须备份 + 二次确认
以下条目纳入时**强制**满足"写系统前自动备份 + 弹窗二次确认 + 可回滚"：

- **#3 WinSxS ResetBase**：执行后无法卸载已装更新，默认关闭，仅在"专家模式"提供并红字警告。
- **#24–#29 映像部署/挂载/引导修复/WinRE**：直接影响系统可启动性，属重装模块核心，须放到 P3 阶段并配合卷影/还原点/独立恢复路径。
- **#7 服务优化、#14/#15 Appx 卸载**：采用**白名单制**（只允许动经过验证的安全项），禁止"全选禁用"。
- **#31 还原点**：建议作为**所有写系统操作的统一前置**（先建点再动手）。

---

## 4. 建议本期优先纳入的能力清单（可执行命令草案）

> 以下命令为**脚本开发输入草案**，落地时统一封装到 `scripts/common/`（备份、日志、WMI）+ `scripts/system/`，经主进程 IPC 调度，全部以管理员权限运行，执行前调用统一备份/还原点。
> **本调研仅产出文档，不创建脚本文件。**

### 4.1 系统优化模块 —— 空间回收（对应 #1/#2/#4/#5）

```powershell
# 1) 清理前先评估组件库占用（只读、低风险）
dism /online /cleanup-image /analyzecomponentstore

# 2) 临时文件 / 更新缓存 / 回收站（低风险，执行前记录清单）
Remove-Item "$env:TEMP\*"            -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:WINDIR\Temp\*"     -Recurse -Force -ErrorAction SilentlyContinue
# 清理 Windows 更新下载缓存（建议先停 wuauserv/bits，清理后再启）
Stop-Service wuauserv,bits -ErrorAction SilentlyContinue
Remove-Item "$env:WINDIR\SoftwareDistribution\Download\*" -Recurse -Force -ErrorAction SilentlyContinue
Start-Service wuauserv,bits -ErrorAction SilentlyContinue
Clear-RecycleBin -Force -ErrorAction SilentlyContinue

# 3) WinSxS 组件清理（中风险，默认勾选；官方 cmdlet）
Repair-WindowsImage -Online -StartComponentCleanup

# 4)（专家项，默认关闭，红字警告）ResetBase —— 之后无法卸载已装更新
# Repair-WindowsImage -Online -StartComponentCleanup -ResetBase
```

### 4.2 系统优化模块 —— 服务 / 启动项 / 计划任务（对应 #6/#7/#8，白名单制）

```powershell
# 启动项查看（只读）
Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location

# 服务：仅对白名单内服务改启动类型（写前备份当前 StartupType）
# 例：禁用诊断跟踪（遥测），属可逆操作
Set-Service -Name DiagTrack -StartupType Disabled

# 计划任务：仅禁用白名单项（如客户体验改善计划相关任务）
Disable-ScheduledTask -TaskPath "\Microsoft\Windows\Customer Experience Improvement Program\" -TaskName "Consolidator"
```

### 4.3 系统优化模块 —— 体验/隐私注册表开关（对应 #10/#11，低-中风险，写前导出 .reg）

```powershell
# 资源管理器：显示文件扩展名（低风险，HKCU）
Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name HideFileExt -Value 0

# 遥测降到 Security/Basic（中风险，HKLM，需备份）
Set-ItemProperty "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" -Name AllowTelemetry -Value 0 -Type DWord
# 注：消费者版本最低生效为 Basic；写前 reg export 该子键作回滚。
```

### 4.4 系统优化/初始化模块 —— Appx 清理（对应 #14/#15，白名单制）

```powershell
# 查看已装/预置应用（只读）
Get-AppxPackage | Select-Object Name, PackageFullName
Get-AppxProvisionedPackage -Online | Select-Object DisplayName, PackageName

# 卸载当前用户的白名单应用（中风险）
Get-AppxPackage *Microsoft.XboxGamingOverlay* | Remove-AppxPackage

# 阻止新用户再被安装该预置应用（系统初始化场景）
Remove-AppxProvisionedPackage -Online -PackageName <由 Get-AppxProvisionedPackage 得到的 PackageName>
```

### 4.5 配置备份与迁移 —— 驱动备份（对应 #16/#17，低风险）

```powershell
# 导出当前系统全部第三方驱动到指定目录（官方 cmdlet，重装前备份）
Export-WindowsDriver -Online -Destination "$env:APPDATA\WinTunerPro\backups\drivers"

# 查看在线驱动清单
Get-WindowsDriver -Online -All
```

### 4.6 系统修复 + 统一前置（对应 #22/#31，低-中风险）

```powershell
# 写系统前统一建立还原点（建议作为所有高风险操作的前置）
Checkpoint-Computer -Description "WinTunerPro-BeforeOptimize" -RestorePointType MODIFY_SETTINGS

# 健康检查与修复
Repair-WindowsImage -Online -ScanHealth
Repair-WindowsImage -Online -RestoreHealth
sfc /scannow
```

### 4.7 系统重装与初始化模块 —— 映像部署（对应 #25/#26，P3 阶段，高风险，仅列草案）

```powershell
# 把离线 install.wim 第 N 个版本应用到目标分区（官方 cmdlet）
Expand-WindowsImage -ImagePath "X:\sources\install.wim" -ApplyPath "W:\" -Index 1

# 挂载映像 -> 注入驱动/更新 -> 保存提交
Mount-WindowsImage -ImagePath "X:\sources\install.wim" -Index 1 -Path "C:\mount"
Add-WindowsDriver  -Path "C:\mount" -Driver "D:\drivers" -Recurse
Dismount-WindowsImage -Path "C:\mount" -Save
```

---

## 5. 需要你/用户拍板的合规与风险决策点

1. **关闭 Windows Defender（#12）是否提供？**
   建议**默认不提供**。陪玩场景常有此诉求，但安全与合规风险高。若一定要做，需作为"专家/高级"独立开关、强提示、显式授权、可一键恢复，并需你确认合规口径。

2. **WinSxS ResetBase（#3）是否对小白开放？**
   建议**默认隐藏**，仅"专家模式"提供并红字警告（执行后无法卸载历史更新）。是否开放请拍板。

3. **遥测/隐私关闭（#11）的尺度。**
   关闭 DiagTrack、把 AllowTelemetry 降级属常见优化，但属"修改系统数据收集行为"。建议默认提供"基础"档（保留必要安全遥测），是否提供"全关"档请确认。

4. **服务/Appx/计划任务的白名单由谁定？**
   强烈建议**白名单制**而非全选。需要产品/你给出一份"可安全禁用项"清单作为脚本配置（后续可放 `src/shared/constants` 或 `scripts/common` 的数据文件）。

5. **重装/映像/引导能力（#24–#30）排期与回滚路径。**
   这些是高风险且"纯软方案"下复杂度最高的部分（应用映像、BCD、WinRE）。建议严格放到 P3，并先确定回滚策略（卷影副本 / 还原点 / 独立恢复入口）。

6. **激活相关（#33）确认排除。**
   已按红线标记为禁止纳入，确认无异议即可。

---

## 6. 参考来源

- Microsoft Learn / `microsoftdocs/windows-powershell-docs`（DISM 模块，经 context7 核验）：
  `Repair-WindowsImage`、`Get/Enable/Disable-WindowsOptionalFeature`、`Get-AppxProvisionedPackage`、`Remove-AppxProvisionedPackage`、`Export-WindowsDriver`、`Get-WindowsDriver`、`Get-WindowsCapability`、`Expand-WindowsImage`、`Mount/Dismount-WindowsImage`。
- DISM++ 功能机理（WebSearch）：thewindowsclub、reboottools、grokipedia（NCleaner.dll / Data.xml 清理规则）、及多篇中文使用教程。
- 本项目规则：`.cursor/rules/project-overview.mdc`、`docs/security-compliance.md`。
