import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

/**
 * 主进程 PowerShell 调用器（hardware/gpu/oem/power/reinstall 各 service 复用）。
 *
 * 约定（见 .cursor/rules/code-organization.mdc）：
 *   - 脚本以 ConvertTo-Json 输出结构化结果，成功 { ok:true; data } / 失败 { ok:false; error:{code,message} }；
 *     本调用器负责解析该信封并转成 Promise（成功 resolve data，失败 reject 带可读信息）。
 *   - 渲染进程绝不拼命令；写操作参数（如电源 GUID）由 service 做白名单校验后再传入。
 *
 * 注意：系统级脚本无法在开发环境实测，真实行为需在 Windows 管理员环境验证。
 */

/** 脚本成功信封 */
interface PsSuccess<T> {
  ok: true
  data: T
}

/** 脚本失败信封 */
interface PsFailure {
  ok: false
  error?: { code?: string; message?: string }
}

type PsEnvelope<T> = PsSuccess<T> | PsFailure

/** GUID 形态白名单（防命令注入：写操作参数仅允许标准 GUID） */
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** 校验是否为标准 GUID（供写操作 service 做参数白名单校验） */
export function isGuid(value: string): boolean {
  return typeof value === 'string' && GUID_RE.test(value)
}

/**
 * 解析脚本根目录。
 * 开发态：脚本在项目根 scripts/（app.getAppPath() 指向项目根）。
 * 打包态：需通过 electron-builder extraResources 将 scripts/ 落到 process.resourcesPath/scripts
 *        （当前 electron-builder.yml 未配置该项，见汇报「未决问题」）。
 */
export function resolveScriptsRoot(): string {
  return is.dev ? join(app.getAppPath(), 'scripts') : join(process.resourcesPath, 'scripts')
}

/**
 * 解析离线资源根目录（reinstall 镜像探测用）。
 * 开发态指向项目根 resources/；打包态指向 process.resourcesPath/resources。
 */
export function resolveResourcesRoot(): string {
  return is.dev ? join(app.getAppPath(), 'resources') : join(process.resourcesPath, 'resources')
}

/** 把可能被 ConvertTo-Json 折叠成单对象的字段稳健地规整为数组 */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value === null || value === undefined) return []
  return [value as T]
}

/**
 * 调用指定 PowerShell 脚本并解析其 JSON 信封。
 *
 * @param relativeScript 相对 scripts/ 的脚本路径，如 'system/Get-SystemInfo.ps1'
 * @param args           传给脚本的参数（写操作参数须先经白名单校验）
 * @param timeoutMs      超时（毫秒），超时按错误处理
 * @returns 解析后的 data
 * @throws 脚本超时 / 非零退出 / 输出无法解析 / 信封 ok:false 时，抛出带可读信息的错误
 */
export function runPowerShell<T>(
  relativeScript: string,
  args: string[] = [],
  timeoutMs = 30_000,
): Promise<T> {
  const scriptPath = join(resolveScriptsRoot(), relativeScript)
  const psArgs = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...args,
  ]

  return new Promise<T>((resolve, reject) => {
    execFile(
      'powershell.exe',
      psArgs,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout, stderr) => {
        // 超时：execFile 会 kill 子进程并置 killed
        if (err && (err as NodeJS.ErrnoException & { killed?: boolean }).killed) {
          reject(new Error(`脚本执行超时（${timeoutMs}ms）：${relativeScript}`))
          return
        }

        // 去掉可能的 BOM 与首尾空白
        const text = (stdout ?? '').replace(/^\uFEFF/, '').trim()
        if (!text) {
          const extra = [stderr?.trim(), err?.message].filter(Boolean).join('；')
          reject(new Error(`脚本无输出：${relativeScript}${extra ? `（${extra}）` : ''}`))
          return
        }

        let envelope: PsEnvelope<T>
        try {
          envelope = JSON.parse(text) as PsEnvelope<T>
        } catch {
          reject(new Error(`脚本输出解析失败：${relativeScript}；原始输出：${text.slice(0, 500)}`))
          return
        }

        if (!envelope || typeof envelope !== 'object' || !('ok' in envelope)) {
          reject(new Error(`脚本输出格式异常：${relativeScript}`))
          return
        }

        if (envelope.ok) {
          resolve(envelope.data)
        } else {
          const code = envelope.error?.code ?? 'E_UNKNOWN'
          const message = envelope.error?.message ?? '脚本返回失败但未提供原因'
          reject(new Error(`[${code}] ${message}`))
        }
      },
    )
  })
}
