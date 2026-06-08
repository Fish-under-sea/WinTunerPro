import { useEffect, useState } from 'react'
import { useAppInfoStore } from '@renderer/store/settingsStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import { PageHeader, SectionCard, Card, InfoList, Switch, Skeleton } from '@renderer/components/ui'
import type { InfoRow } from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import { orDash } from '@renderer/lib/format'

interface PrefItem {
  id: string
  name: string
  desc: string
  defaultOn: boolean
}

const PREFS: PrefItem[] = [
  { id: 'autostart', name: '开机自启动', desc: '开机后自动在后台准备就绪', defaultOn: false },
  {
    id: 'autocheck',
    name: '启动时自动体检',
    desc: '每次打开应用时快速检查系统状态',
    defaultOn: true,
  },
  {
    id: 'reduce-motion',
    name: '减少动画效果',
    desc: '降低界面动效，提升低配设备流畅度',
    defaultOn: false,
  },
]

export function SettingsPage(): React.JSX.Element {
  const { data, loading, error, loaded, load } = useAppInfoStore()
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PREFS.map((p) => [p.id, p.defaultOn])),
  )

  useEffect(() => {
    void load()
  }, [load])

  const aboutRows: InfoRow[] = [
    { label: '应用版本', value: orDash(data?.version) },
    { label: 'Electron 版本', value: orDash(data?.electronVersion) },
    { label: '运行平台', value: orDash(data?.platform) },
  ]

  return (
    <div>
      <PageHeader icon="settings" title="设置" description="管理应用偏好，查看版本与关于信息。" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard icon="settings" title="偏好设置" description="这些偏好仅影响本应用的行为。">
          <div className="space-y-2.5">
            {PREFS.map((pref) => (
              <Card
                key={pref.id}
                padding="sm"
                className="flex items-center justify-between gap-4 !rounded-xl !shadow-none"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">{pref.name}</div>
                  <p className="mt-0.5 text-xs text-text-muted">{pref.desc}</p>
                </div>
                <Switch
                  label={pref.name}
                  checked={prefs[pref.id] ?? false}
                  onChange={(v) => setPrefs((p) => ({ ...p, [pref.id]: v }))}
                />
              </Card>
            ))}
          </div>
        </SectionCard>

        <SectionCard icon="info" title="关于" description="WinTuner Pro 版本与运行环境。">
          <AsyncBoundary
            loading={loading && !loaded}
            error={error}
            onRetry={() => void load(true)}
            skeleton={
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            }
          >
            <InfoList rows={aboutRows} />
            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-surface-2 px-4 py-3 text-xs text-text-muted">
              <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                WinTuner Pro
                仅做系统初始化与优化，严禁任何反作弊绕过、破解或规避检测行为。所有写系统操作均可备份与还原。
              </span>
            </div>
          </AsyncBoundary>
        </SectionCard>
      </div>
    </div>
  )
}
