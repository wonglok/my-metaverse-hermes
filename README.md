# Lambobo Palace

A multiplayer 3D world that runs in your browser. You walk around, see other people in real time, and chat with them — no download, no account, just open the link and jump in.

## What you can do

- **Explore** — walk around a 3D world with joystick or keyboard controls
- **See others** — other people in the same place appear as avatars you can see moving in real time
- **Chat** — send text messages or short voice clips that everyone nearby can hear
- **Name yourself** — pick any name you want; change it anytime
- **Create places** — type any name to make a new room and invite friends

## How it works (the simple version)

When you open the site, your browser connects to a server and joins a "place" — think of it like a chat room, but with a 3D map. Your position, movement, name, and messages are sent to everyone else in that place. When you move, other people see you move. When they chat, you see their messages.

The 3D world is rendered with Three.js. The real-time stuff happens over WebSockets — a technology that keeps a live connection open between your browser and the server, like a phone call instead of sending letters back and forth.

## For developers

### Tech stack

- **Frontend** — React + Three.js (React Three Fiber) for the 3D world
- **Real-time** — WebSockets via Nitro + crossws
- **Server** — Nitro v3 running on Vercel Functions
- **Multi-server** — Redis pub/sub so people on different servers still see each other
- **Styling** — Tailwind CSS + shadcn/ui

### Project layout

```
app/                  # Browser-side code (React SPA)
├── pages/
│   ├── landing.tsx   # Home page — pick a place to enter
│   └── game.tsx      # The 3D world — game loop, HUD, chat
├── components/
│   ├── metaverse/    # 3D rendering: world, avatars, physics, camera, joystick
│   ├── chat/         # Chat window and voice recording
│   └── ui/           # shadcn/ui primitives
└── hooks/
    ├── use-realtime.ts   # WebSocket connection, reconnect, heartbeat
    └── use-metaverse.ts  # Game state: players, chat, movement

shared/
└── types/realtime.ts     # The message types shared between client and server

server/
├── api/ws.ts             # WebSocket handler — join, move, chat, voice
└── utils/
    ├── identity.ts       # Random name + color for each connection
    └── redis.ts          # Redis pub/sub for multi-server scaling
```

### Running locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` in two browser tabs to see live multiplayer in action.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `METAVERSE_REDIS_URL` | No | Redis connection for multi-server mode. Without it, everything runs in memory on a single server. |

### Adding features

- **New message types** — add a variant to `ClientMessage` / `ServerMessage` in `shared/types/realtime.ts`, then handle it in `server/api/ws.ts`
- **New 3D objects** — add components under `app/components/metaverse/` and place them in `world.tsx`
- **New places** — add entries to the `DEMO_PLACES` array in `app/pages/landing.tsx`

## License

MIT — see [LICENSE](./LICENSE)
