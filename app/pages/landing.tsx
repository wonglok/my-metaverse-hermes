import { useNavigate } from "react-router";
import { useState } from "react";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { cn } from "@/lib/utils";

const DEMO_PLACES = [
  {
    id: "plaza",
    name: "Central Plaza",
    description: "The main gathering hub. Meet, chat, and explore.",
  },
  // {
  //   id: "garden",
  //   name: "Sky Garden",
  //   description: "A floating garden with platforms to discover.",
  // },
  // {
  //   id: "arena",
  //   name: "Battle Arena",
  //   description: "Open space for games and challenges.",
  // },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [customId, setCustomId] = useState("");

  function enterPlace(placeId: string) {
    navigate(`/game/${placeId}`);
  }

  function handleCustomEnter(e: React.FormEvent) {
    e.preventDefault();
    const id = customId.trim().toLowerCase().replace(/\s+/g, "-");
    if (id) enterPlace(id);
  }

  return (
    <div className="relative min-h-screen bg-white">
      <HeroBackdrop />

      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-20">
        <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
          <h1 className="max-w-2xl text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Lambobo Palace
          </h1>
          <p className="max-w-lg text-balance text-lg leading-relaxed text-gray-600">
            Enter a multiplayer 3D world. Explore places, chat with others, and
            build together.
          </p>
        </section>

        {/* Place cards */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
            Featured Places
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {DEMO_PLACES.map((place) => (
              <button
                key={place.id}
                onClick={() => enterPlace(place.id)}
                className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:border-primary/60 hover:shadow-md"
              >
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary transition-colors">
                  {place.name}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  {place.description}
                </p>
                <span className="mt-2 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Enter &rarr;
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Custom place */}
        <section className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Or create a new place
          </h3>
          <form
            onSubmit={handleCustomEnter}
            className="flex w-full max-w-sm gap-2"
          >
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="Enter a place name..."
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!customId.trim()}
              className={cn(
                "rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition",
                "hover:opacity-90 disabled:opacity-40",
              )}
            >
              Go
            </button>
          </form>
        </section>

        {/* Admin link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Managing a place?{" "}
            <button
              onClick={() => {
                const id = customId.trim() || DEMO_PLACES[0].id;
                navigate(`/admin/${id}`);
              }}
              className="font-medium text-gray-700 underline hover:text-gray-900 transition-colors"
            >
              Open Admin Portal
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
