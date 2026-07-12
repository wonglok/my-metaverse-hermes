import { useNavigate } from "react-router";
import { useState } from "react";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { cn } from "@/lib/utils";
// import { SideRays } from "@/components/fancy/SideRays";
// import Orb from "@/components/fancy/Orb";
import Lightfall from "@/components/fancy/Lightfall";

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

function PlaceIcon({ id }: { id: string }) {
  const iconClass =
    "size-5 text-white/40 group-hover:text-primary/70 transition-colors duration-300";
  switch (id) {
    case "plaza":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <rect x="3" y="11" width="18" height="11" rx="1" />
          <path d="M3 11 12 5l9 6" />
          <line x1="9" y1="21" x2="9" y2="15" />
          <line x1="15" y1="21" x2="15" y2="15" />
        </svg>
      );
    case "garden":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case "arena":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClass}
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
  }
}

export function LandingPage() {
  const navigate = useNavigate();
  const [customId, setCustomId] = useState("");

  function enterPlace(placeId: string) {
    navigate(`/game/${placeId}`);
  }

  function handleCustomEnter(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = customId.trim().toLowerCase().replace(/\s+/g, "-");
    if (id) enterPlace(id);
  }

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <HeroBackdrop />
      <div className=" absolute top-0 left-0 w-full h-full">
        {/* <SideRays></SideRays> */}
        {/* <Orb
          hoverIntensity={0}
          rotateOnHover={false}
          hue={168}
          forceHoverState={false}
          backgroundColor="#ffffff"
        ></Orb> */}
        <Lightfall
          colors={["#A6C8FF", "#5227FF", "#FF9FFC"]}
          backgroundColor="#0A29FF"
          speed={0.3}
          streakCount={2}
          streakWidth={0.9}
          streakLength={1.4}
          glow={1}
          density={0.6}
          twinkle={0.75}
          zoom={1.2}
          backgroundGlow={0.7}
          opacity={1}
          mouseInteraction
          mouseStrength={0.2}
          mouseRadius={1.1}
        />
      </div>

      <main className="relative z-10 mx-auto max-w-4xl px-5 sm:px-6 pb-16 sm:pb-24">
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-5 py-24 text-center sm:py-32">
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Multiverse
              {/* <br className="sm:hidden" />  */}
            </h1>
          </div>
          <p className="max-w-lg text-balance text-lg leading-relaxed text-white/80 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-backwards">
            Enter a multiplayer 3D world. Explore places, chat with others, and
            build together.
          </p>
        </section>

        {/* ── Featured Places ────────────────────────────────── */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-backwards">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Featured Places
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {DEMO_PLACES.map((place) => (
              <button
                key={place.id}
                onClick={() => enterPlace(place.id)}
                className={cn(
                  "group flex flex-col gap-3 rounded-2xl p-5 text-left",
                  "border border-white/[0.07] bg-white/[0.22] backdrop-blur-xl",
                  "transition-all duration-300 ease-out",
                  "hover:bg-white/[0.05] hover:border-white/[0.14] hover:scale-[1.015]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                )}
              >
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    "bg-white/[0.04] ring-1 ring-white/[0.06]",
                    "group-hover:bg-primary/8 group-hover:ring-primary/15",
                    "transition-all duration-300",
                  )}
                >
                  <PlaceIcon id={place.id} />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold text-white/90 group-hover:text-white transition-colors duration-300">
                    {place.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/70 group-hover:text-white/55 transition-colors duration-300">
                    {place.description}
                  </p>
                </div>
                <span className="text-xs font-medium text-primary/0 group-hover:text-primary/70 transition-all duration-300 translate-x-0 group-hover:translate-x-0.5">
                  Enter &rarr;
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Custom Place ──────────────────────────────────── */}
        <section
          className={cn(
            "mt-6 flex flex-col items-center gap-4 rounded-2xl p-6 sm:p-8 text-center",
            "border border-white/[0.06] bg-white/[0.22] backdrop-blur-xl",
            "animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-backwards",
          )}
        >
          <div>
            <h3 className="text-base font-semibold text-white/80">
              Or create a new place
            </h3>
            <p className="mt-1 text-sm text-white/35">
              Type any name and jump right in.
            </p>
          </div>
          <form
            onSubmit={handleCustomEnter}
            className="flex w-full max-w-sm gap-2"
          >
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="Enter a place name..."
              aria-label="Place name"
              className={cn(
                "min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm",
                "bg-white/[0.04] border border-white/[0.08]",
                "text-white placeholder:text-white/25",
                "outline-none backdrop-blur-sm",
                "focus:border-white/20 focus:ring-1 focus:ring-white/10",
                "transition",
              )}
            />
            <button
              type="submit"
              disabled={!customId.trim()}
              className={cn(
                "rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all",
                "hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              )}
            >
              Go
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
