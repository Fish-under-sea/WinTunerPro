import { useEffect, useState } from 'react'
import { useWallpaperStore } from '@renderer/store/wallpaperStore'
import { AsyncBoundary } from '@renderer/components/AsyncBoundary'
import {
  PageHeader,
  SectionCard,
  Card,
  Tag,
  Button,
  Tabs,
  Skeleton,
  EmptyState,
} from '@renderer/components/ui'
import type { TabItem } from '@renderer/components/ui'
import { Icon } from '@renderer/components/icons'
import type { WallpaperItem } from '@shared/types'

const TABS: TabItem[] = [
  { value: 'static', label: '静态壁纸', icon: 'image' },
  { value: 'dynamic', label: '动态壁纸', icon: 'play' },
]

export function WallpaperPage(): React.JSX.Element {
  const {
    data,
    engine,
    loading,
    error,
    loaded,
    applyingId,
    guiding,
    load,
    applyStatic,
    guideInstallEngine,
  } = useWallpaperStore()
  const [tab, setTab] = useState('static')

  useEffect(() => {
    void load()
  }, [load])

  const staticItems = data?.items.filter((i) => i.type === 'static') ?? []
  const dynamicItems = data?.items.filter((i) => i.type === 'dynamic') ?? []

  return (
    <div>
      <PageHeader
        icon="image"
        title="壁纸中心"
        description="静态壁纸直接设为系统桌面背景、零后台驻留；动态壁纸通过 Wallpaper Engine 呈现。"
        action={<Tabs items={TABS} value={tab} onChange={setTab} />}
      />

      <AsyncBoundary
        loading={loading && !loaded}
        error={error}
        onRetry={() => void load(true)}
        skeleton={
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-xl" />
            ))}
          </div>
        }
      >
        {tab === 'static' ? (
          <SectionCard
            icon="image"
            title="静态壁纸画廊"
            description="点击「设为壁纸」即可应用为桌面背景，不占用任何后台资源。"
          >
            {staticItems.length === 0 ? (
              <EmptyState
                icon="image"
                title="暂无静态壁纸"
                description="随包壁纸资源就绪后将显示在这里。"
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {staticItems.map((item) => (
                  <WallpaperTile
                    key={item.id}
                    item={item}
                    current={data?.currentWallpaperId === item.id}
                    loading={applyingId === item.id}
                    disabled={applyingId !== null}
                    onApply={() => void applyStatic(item.id)}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        ) : (
          <div className="space-y-5">
            <SectionCard
              icon="play"
              title="动态壁纸"
              description="动态壁纸由 Steam 平台的 Wallpaper Engine 驱动。"
            >
              {engine?.installed ? (
                dynamicItems.length === 0 ? (
                  <EmptyState
                    icon="play"
                    title="暂无动态壁纸"
                    description="从 Wallpaper Engine 创意工坊订阅后，将在这里聚合展示。"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {dynamicItems.map((item) => (
                      <WallpaperTile
                        key={item.id}
                        item={item}
                        current={data?.currentWallpaperId === item.id}
                        loading={false}
                        disabled
                        onApply={() => undefined}
                        dynamic
                      />
                    ))}
                  </div>
                )
              ) : (
                <EngineGuide
                  detectedViaSteam={engine?.detectedViaSteam ?? false}
                  loading={guiding}
                  onGuide={() => void guideInstallEngine()}
                />
              )}
            </SectionCard>
          </div>
        )}
      </AsyncBoundary>
    </div>
  )
}

function WallpaperTile({
  item,
  current,
  loading,
  disabled,
  onApply,
  dynamic = false,
}: {
  item: WallpaperItem
  current: boolean
  loading: boolean
  disabled: boolean
  onApply: () => void
  dynamic?: boolean
}): React.JSX.Element {
  const [imgError, setImgError] = useState(false)
  return (
    <Card padding="none" className="group overflow-hidden">
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-sky-200 via-indigo-200 to-slate-200">
        {!imgError && (
          <img
            src={item.thumbnail}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-slow group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        )}
        {imgError && (
          <div className="flex h-full w-full items-center justify-center text-white/70">
            <Icon name={dynamic ? 'play' : 'image'} size={28} />
          </div>
        )}
        {current && (
          <span className="absolute left-2 top-2">
            <Tag tone="success" icon="check">
              当前
            </Tag>
          </span>
        )}
        {dynamic && (
          <span className="absolute right-2 top-2">
            <Tag tone="primary" icon="play">
              动态
            </Tag>
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="truncate text-sm font-medium text-text" title={item.name}>
          {item.name}
        </span>
        {dynamic ? (
          <Tag tone="neutral">需引擎</Tag>
        ) : (
          <Button
            size="sm"
            variant={current ? 'outline' : 'secondary'}
            loading={loading}
            disabled={disabled || current}
            onClick={onApply}
          >
            {current ? '使用中' : '设为壁纸'}
          </Button>
        )}
      </div>
    </Card>
  )
}

function EngineGuide({
  detectedViaSteam,
  loading,
  onGuide,
}: {
  detectedViaSteam: boolean
  loading: boolean
  onGuide: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border-strong bg-surface-2 px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon name="play" size={26} />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-text">未检测到 Wallpaper Engine</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-text-muted">
        动态壁纸需要 Steam 平台的 Wallpaper Engine（AppId 431960）。
        {detectedViaSteam ? '已检测到 Steam，可一键前往安装。' : '安装 Steam 后即可获取。'}
      </p>
      <Button className="mt-4" leftIcon="external" loading={loading} onClick={onGuide}>
        前往安装引导
      </Button>
    </div>
  )
}
