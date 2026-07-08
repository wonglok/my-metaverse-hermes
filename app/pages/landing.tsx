import { useNavigate } from 'react-router'
import { useState } from 'react'
import { HeroBackdrop } from '@/components/hero-backdrop'
import { cn } from '@/lib/utils'

const DEMO_PLACES = [
  { id: 'plaza', name: 'Central Plaza', description: 'The main gathering hub. Meet, chat, and explore.' },
  { id: 'garden', name: 'Sky Garden', description: 'A floating garden with platforms to discover.' },
  { id: 'arena', name: 'Battle Arena', description: 'Open space for games and challenges.' },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [customId, setCustomId] = useState('')

  function enterPlace(placeId: string) {
    navigate(`/game/${placeId}`)
  }

  function handleCustomEnter(e: React.FormEvent) {
    e.preventDefault()
    const id = customId.trim().toLowerCase().replace(/\s+/g, '-')
    if (id) enterPlace(id)
  }

  return (
    <div className="relative min-h-screen">
      <HeroBackdrop />

      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-20">
        <section className="flex flex-col items-center gap-5 py-16 text-center sm:py-24">
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Lambobo Palace
          </h1>
          <p className="max-w-lg text-balance text-lg text-muted-foreground">
            Enter a multiplayer 3D world. Explore places, chat with others, and build together.
          </p>
        </section>

        {/* Place cards */}
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Featured Places
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {DEMO_PLACES.map((place) => (
              <button
                key={place.id}
                onClick={() => enterPlace(place.id)}
                className="group flex flex-col gap-2 rounded-xl border bg-card p-6 text-left transition hover:border-primary/50 hover:shadow-lg"
              >
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {place.name}
                </h3>
                <p className="text-sm text-muted-foreground">{place.description}</p>
                <span className="mt-2 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Enter &rarr;
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Custom place */}
        <section className="mt-10 flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center">
          <h3 className="font-semibold">Or create a new place</h3>
          <form onSubmit={handleCustomEnter} className="flex w-full max-w-sm gap-2">
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="Enter a place name..."
              className="min-w-0 flex-1 rounded-lg border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!customId.trim()}
              className={cn(
                'rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition',
                'hover:opacity-90 disabled:opacity-40',
              )}
            >
              Go
            </button>
          </form>
        </section>

        {/* Admin link */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Managing a place?{' '}
            <button
              onClick={() => {
                const id = customId.trim() || DEMO_PLACES[0].id
                navigate(`/admin/${id}`)
              }}
              className="underline hover:text-foreground transition-colors"
            >
              Open Admin Portal
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
