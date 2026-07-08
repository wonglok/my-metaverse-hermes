import { useParams, useNavigate } from 'react-router'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface PlaceContent {
  name: string
  description: string
  spawnPoint: [number, number, number]
  platforms: { position: [number, number, number]; size: [number, number, number] }[]
  skyColor: string
  groundColor: string
}

const STORAGE_KEY_PREFIX = 'hermes-place-'

function loadContent(placeId: string): PlaceContent {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${placeId}`)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {
    name: placeId,
    description: '',
    spawnPoint: [0, 2, 0],
    platforms: [
      { position: [3, 0.5, -3], size: [2, 1, 2] },
      { position: [-4, 0.75, -2], size: [2, 1.5, 2] },
      { position: [0, 0.5, -6], size: [4, 1, 1.5] },
    ],
    skyColor: '#87CEEB',
    groundColor: '#2d5a27',
  }
}

function saveContent(placeId: string, content: PlaceContent) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${placeId}`, JSON.stringify(content))
}

export function AdminPage() {
  const { placeId } = useParams<{ placeId: string }>()
  const navigate = useNavigate()
  const pid = placeId ?? 'default'

  const [content, setContent] = useState<PlaceContent>(() => loadContent(pid))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setContent(loadContent(pid))
  }, [pid])

  function handleSave() {
    saveContent(pid, content)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateField<K extends keyof PlaceContent>(key: K, value: PlaceContent[K]) {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  function addPlatform() {
    setContent((prev) => ({
      ...prev,
      platforms: [...prev.platforms, { position: [0, 0.5, -8], size: [2, 1, 2] }],
    }))
  }

  function removePlatform(index: number) {
    setContent((prev) => ({
      ...prev,
      platforms: prev.platforms.filter((_, i) => i !== index),
    }))
  }

  function updatePlatform(
    index: number,
    field: 'position' | 'size',
    axis: number,
    value: number,
  ) {
    setContent((prev) => {
      const platforms = [...prev.platforms]
      platforms[index] = { ...platforms[index], [field]: platforms[index][field].map((v, i) => (i === axis ? value : v)) as [number, number, number] }
      return { ...prev, platforms }
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Home
            </button>
            <h1 className="text-lg font-semibold">
              Admin: <span className="text-primary">{pid}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/game/${pid}`)}
              className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-accent"
            >
              View Place
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {/* Basic info */}
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Place Info</h2>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Display Name</span>
            <input
              type="text"
              value={content.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">Description</span>
            <textarea
              value={content.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Sky Color</span>
              <input
                type="color"
                value={content.skyColor}
                onChange={(e) => updateField('skyColor', e.target.value)}
                className="h-10 w-full rounded-lg border"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Ground Color</span>
              <input
                type="color"
                value={content.groundColor}
                onChange={(e) => updateField('groundColor', e.target.value)}
                className="h-10 w-full rounded-lg border"
              />
            </label>
          </div>
        </section>

        {/* Spawn point */}
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Spawn Point</h2>
          <div className="grid grid-cols-3 gap-3">
            {(['X', 'Y', 'Z'] as const).map((axis, i) => (
              <label key={axis} className="flex flex-col gap-1.5">
                <span className="text-sm text-muted-foreground">{axis}</span>
                <input
                  type="number"
                  step="0.1"
                  value={content.spawnPoint[i]}
                  onChange={(e) => {
                    const v = [...content.spawnPoint] as [number, number, number]
                    v[i] = Number(e.target.value)
                    updateField('spawnPoint', v)
                  }}
                  className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Platforms */}
        <section className="space-y-4 rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Platforms</h2>
            <button
              onClick={addPlatform}
              className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-accent"
            >
              + Add Platform
            </button>
          </div>

          {content.platforms.length === 0 && (
            <p className="text-sm text-muted-foreground">No platforms yet. Add one above.</p>
          )}

          <div className="space-y-4">
            {content.platforms.map((platform, idx) => (
              <div key={idx} className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Platform {idx + 1}</span>
                  <button
                    onClick={() => removePlatform(idx)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                    <label key={`pos-${axis}`} className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">Position {axis}</span>
                      <input
                        type="number"
                        step="0.1"
                        value={platform.position[i]}
                        onChange={(e) => updatePlatform(idx, 'position', i, Number(e.target.value))}
                        className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['W', 'H', 'D'] as const).map((axis, i) => (
                    <label key={`size-${axis}`} className="flex flex-col gap-1">
                      <span className="text-[10px] text-muted-foreground">Size {axis}</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={platform.size[i]}
                        onChange={(e) => updatePlatform(idx, 'size', i, Math.max(0.1, Number(e.target.value)))}
                        className="rounded border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold text-destructive">Danger Zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This resets all configuration for this place back to defaults.
          </p>
          <button
            onClick={() => {
              if (confirm('Reset all settings for this place?')) {
                localStorage.removeItem(`${STORAGE_KEY_PREFIX}${pid}`)
                setContent(loadContent(pid))
              }
            }}
            className="mt-3 rounded-lg border border-destructive/50 px-4 py-1.5 text-sm text-destructive transition hover:bg-destructive/10"
          >
            Reset to Defaults
          </button>
        </section>
      </main>
    </div>
  )
}
