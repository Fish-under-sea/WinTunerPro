> **⏸️ Paused** · Last commit: 2026-06-24 (about 3 months ago)
>
> Features have reached v0.2.2 and the core flow is usable; further scheduling depends on real-world feedback, and bug reports are still read.

<div align="center">

# WinTuner Pro

**A one-click optimization tool for gaming companion setups · v0.2.2**

![Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-42-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)

So every companion player can perform at their best.

[简体中文](README.md) · **English**

</div>

---

## 📖 Overview

WinTuner Pro is a Windows desktop optimization tool for **gaming companion providers and small studios (3–10 people)**. It folds the whole "system reinstall + optimization + beautification" workflow — normally the preserve of an IT technician — into one **visual, foolproof** application, so that even complete beginners can do it in one click.

Unlike technician-oriented tools such as DISM++, WinTuner Pro targets beginners: visual guidance throughout, zero command line, and a software-only approach that needs no PE drive.

## 🎯 Four design principles

| Principle | Meaning |
|-----------|---------|
| **Zero barrier** | Graphical guidance throughout; no commands to memorize |
| **Software-only** | No PE boot drive, no opening up the machine |
| **Recoverable** | Automatic backup before high-risk operations, with rollback support |
| **Compliance boundary** | **No anti-cheat bypass logic of any kind** |

## ✨ Feature modules (10 pages)

| Module | What it does | Status |
|--------|--------------|:------:|
| **Dashboard** | System overview and quick entry points | ✅ |
| **Hardware info** | Reads device and system information (`Get-SystemInfo.ps1` / `Get-DeviceInfo.ps1`) | ✅ |
| **GPU tuning** | GPU detection and tuning presets (`Apply-GpuTweaks.ps1` / `Set-NvidiaProfile.ps1` / `Set-NvidiaPreset.ps1`) | ✅ NVIDIA path complete; **AMD only declared, no dedicated script found** |
| **OEM scheduling** | Identifies the system brand and switches vendor performance modes (`Get-ChassisAndBrand.ps1` / `Set-OemPerformanceMode.ps1`) | ✅ Lenovo / ASUS / HP / Dell / Razer / Mechrevo / Machenike / Hasee |
| **System optimization** | 15 whitelisted optimizations (see the table below) | ⚠️ Some items, see "Known limitations" below |
| **System reinstall** | Image source management, ISO verification, **MachineGuid** reset, deployment progress | ✅ |
| **System beautification** | Deploys TranslucentTB, Winstep Nexus, and presets | ⚠️ Requires your own offline installers |
| **Wallpaper center** | Wallpaper management, Wallpaper Engine detection and guidance | ✅ |
| **Configuration backup** | Backup snapshots / restore / import and export `.wtp` | ✅ |
| **Settings** | Application preferences | ✅ |

### System optimization whitelist (15 items, verbatim from `src/shared/types/optimization.ts`)

```
temp  ·  recycle  ·  wu-cache  ·  fileext  ·  power-ultimate
winsxs  ·  resetbase  ·  startup  ·  diagtrack  ·  ceip
autoplay  ·  telemetry  ·  xbox  ·  news  ·  tips
```

> ⚠️ **`resetbase` is an expert item and is off by default**, with a red warning — once run, **you can no longer uninstall installed Windows updates**.

## 🚀 Download and installation

Get the latest installer from Releases:

- **Latest**: [`WinTuner.Pro.Setup.0.2.2.exe`](https://github.com/Fish-under-sea/WinTunerPro/releases/download/v0.2.2/WinTuner.Pro.Setup.0.2.2.exe) (about 137 MB)
- All versions: [the Releases page](https://github.com/Fish-under-sea/WinTunerPro/releases) (v0.1.0 / 0.1.1 / 0.1.2 / 0.2.0 / 0.2.1 / 0.2.2)

**Before installing**:

- The app runs with **administrator privileges** (the manifest declares `requireAdministrator`) — required for system-level optimization
- The installer is **not code-signed**, so Windows SmartScreen may warn you; allow it manually
- The large offline resources under `resources/` (drivers / fonts / runtimes) are **not distributed with the repository**; place them yourself and repackage (see [`resources/README.md`](resources/README.md))

## 🛠️ Tech stack

| Layer | Implementation |
|-------|----------------|
| Desktop framework | **Electron 42** (main window 1280×832, `contextIsolation: true` / `nodeIntegration: false`) |
| UI | **React 19** + React Router 7 + Zustand 5 + Framer Motion 12 |
| Styling | **Tailwind CSS 3.4** (all theming via CSS variables, a unified corner-radius scale of 8/10/14/18 px) |
| Build | **electron-vite 5** + Vite 7 (main / preload / renderer compiled separately) |
| Language | **TypeScript 6** |
| Quality | ESLint 9 + Prettier 3 + **Vitest 4** (9 test files) |
| Packaging | **electron-builder 26** → NSIS installer, output to `release/` |
| Execution layer | Node `child_process` → **PowerShell** (`scripts/**/*.ps1`) |

## 📦 Available commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development mode (all three targets compiled + HMR) |
| `npm start` | Preview the built artifacts |
| `npm run build` | Type check + build all three targets |
| `npm run build:unpack` | Unpacked build (directory form, convenient for self-testing) |
| `npm run package` | Produce the NSIS installer → `release/` |
| `npm run typecheck` | Combined type check across `tsconfig.node.json` + `tsconfig.web.json` |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint check and fix |
| `npm run format` | Prettier formatting |
| `npm run format:check` | Prettier format check |
| `npm test` | Run Vitest once |

## 🖥️ Development environment

| Item | Requirement |
|------|-------------|
| Operating system | Windows 10 / 11 (`package.json` restricts `"os": ["win32"]`) |
| Node.js | ≥ 18 (declared in `engines`) |
| PowerShell | 5.1 or 7.x |
| Privileges | Administrator (required for system operations) |
| Testing advice | **Test high-risk PowerShell operations on a restorable virtual machine** |

## 📁 Directory structure

```text
WinTunerPro/
├── build/                    icon.ico + win/app.manifest
├── docs/                     Product and engineering documentation
│   ├── roadmap.md            Roadmap
│   ├── security-compliance.md Security and compliance notes
│   ├── conventions.md        Engineering conventions
│   ├── dismpp-reference.md   DISM++ technical research
│   └── WinTunerPro_PRD_v1.docx / Pitch_v3.pptx
├── resources/                Offline resources (drivers/fonts/runtimes/themes; empty in the repository)
├── scripts/                  PowerShell execution layer
│   ├── backup/  beautify/  common/  gpu/  oem/  system/  wallpaper/
├── src/
│   ├── main/                 Main process (ipc/ 11 files + services/ 11 files)
│   ├── preload/              Whitelisted IPC bridge
│   ├── renderer/             React UI (pages/ 10 + store/ 12 + components/ui/ 19)
│   └── shared/               IPC channel constants and types
├── tests/                    9 Vitest tests
├── electron-builder.yml      Packaging configuration
└── electron.vite.config.ts   Three-target build configuration
```

## 🔒 Security and compliance

| Measure | Notes |
|---------|-------|
| **Automatic backup** | Backs up to `%AppData%\WinTunerPro\backups` before writing to the system; `reg export` produces a `.reg` snapshot before registry operations |
| **IPC whitelist** | The renderer can only call methods explicitly exposed by preload; `ipcRenderer` is not passed through, and the main process validates arguments against a whitelist to avoid command injection |
| ⚠️ **Know the isolation strength** | The renderer has `contextIsolation` enabled and `nodeIntegration` disabled, but `sandbox: false`, and preload contains a "fallback that hangs things on `window` in a non-isolated environment" branch — isolation is therefore **weaker than** Chromium's default sandbox, and the "fully isolated" wording in the security document is optimistic |
| **Backup first** | `scripts/README.md` requires calling the `common` backup functions before writing to the registry / services / power / drivers |
| **Red line** | `docs/dismpp-reference.md` lists "anti-cheat bypass / cracking / detection evasion" as **excluded** |
| **Second confirmation for high risk** | High-risk items require "backup + second confirmation"; `ResetBase` is off by default with a red warning |

## ⚠️ Known limitations (please read first)

> This section reflects **what the code actually does**, and disagrees with some existing descriptions — I have listed it honestly as implemented.

| Item | Actual situation |
|------|------------------|
| **"MachineGuid reset" ≠ "SID reset"** | The code resets only `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` (and an optional telemetry ID). The machine SID is **displayed only** in the service layer and is **never modified** |
| **Startup item cleanup is not implemented** | The `startup` item in the optimization scripts explicitly returns `unimplemented`, telling you to "manage it manually in Task Manager" |
| **No "network optimization" module** | Neither the 15-item whitelist nor the scripts contain **any** DNS / TCP / MTU implementation |
| **`.wtp` is obfuscation, not cryptographic protection** | The container magic is `WTP1` + AES-256-GCM, but the source admits the **key ships inside the app**, making it "at-rest obfuscation / misread prevention" and **not access control** |
| **One-click style-pack theming has been removed** | That feature was **removed in v0.2.1** (`refactor: 移除风格包一键换肤功能并升级版本至 0.2.1`) |
| **The beautification module has prerequisites** | Winstep Nexus requires your own offline installer (it must be placed in `resources/themes/nexus/`); its `[DOCKS]` registry preset "has not yet been verified on a real machine" and **runs with `-DryRun` by default** |
| **Offline resources are empty** | `resources/**` currently holds only `.gitkeep`; `extraResources` packages an empty directory, so place the files yourself and repackage |

## 🩹 How to roll back if something goes wrong

| Scenario | What to do |
|----------|-----------|
| Optimization / beautification changed the wrong thing | Restore a backup snapshot from `%AppData%\WinTunerPro\backups` |
| A registry write | Import the `.reg` snapshot file from the same directory |
| Trouble after a MachineGuid change | Some software may need **reactivating**; `Set-MachineId.ps1` warns clearly, and a restart is required after the change |
| Undoing an application-level operation | The configuration backup page offers `listBackups` / `restoreBackup` / `deleteBackup` |

## 📚 More documentation

| Document | Contents |
|----------|----------|
| [`docs/roadmap.md`](docs/roadmap.md) | Roadmap (P0 infrastructure → P1 system optimization + NVIDIA → P2 OEM + AMD → P3 reinstall → P4 beautification / backup → Beta) |
| [`docs/security-compliance.md`](docs/security-compliance.md) | The complete security and compliance notes |
| [`docs/conventions.md`](docs/conventions.md) | Engineering conventions |
| [`docs/dismpp-reference.md`](docs/dismpp-reference.md) | DISM++ technical research and the rationale for the trade-offs |
| [`docs/README.md`](docs/README.md) | Documentation index |
| [`resources/README.md`](resources/README.md) | Where to place offline resources (large files such as LTSC images are not distributed with the tool) |
| [`build/README.md`](build/README.md) · [`scripts/README.md`](scripts/README.md) · [`tests/README.md`](tests/README.md) | Conventions for each directory |

## 📄 License

This repository **carries no open-source license** (`package.json` declares `"license": "UNLICENSED"`).

**Please do not** treat it as an open-source project free to use or redistribute; contact the author for licensing.

---

<sub>WinTuner Pro v0.2.2 · for gaming companion providers and small studios · software-only, with no anti-cheat bypass</sub>
