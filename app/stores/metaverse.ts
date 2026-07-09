import { create } from "zustand";
import type {
  Peer,
  ChatMessage,
  ServerMessage,
  ClientMessage,
} from "../../shared/types/realtime";
import type { PlayerState } from "../../shared/types/realtime";
import ReconnectingWebSocket from "reconnecting-websocket";

export interface RemotePlayer extends PlayerState {
  targetX: number;
  targetY: number;
  targetZ: number;
  targetRotation: number;
}

// ── Module-level non-reactive state (socket, timers, move throttle) ───────

const HEARTBEAT_INTERVAL = 25_000;
const PONG_TIMEOUT = 10_000;

let _epoch = 0;
let _rws: ReconnectingWebSocket | null = null;
let _heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let _pongTimer: ReturnType<typeof setTimeout> | undefined;
let _pendingMove: { x: number; y: number; z: number; rotation: number } | null =
  null;
let _rafId: number | undefined;

function _sendRaw(msg: ClientMessage) {
  if (_rws?.readyState === WebSocket.OPEN) {
    _rws.send(JSON.stringify(msg));
  }
}

// ── Player map for O(1) lookups ───────────────────────────────────────────

const playerMap = new Map<string, RemotePlayer>();

function _syncPlayers(): RemotePlayer[] {
  return [...playerMap.values()];
}

// ── Store ─────────────────────────────────────────────────────────────────

interface MetaverseState {
  status: "connecting" | "connected" | "disconnected";
  self: Peer | null;
  players: RemotePlayer[];
  messages: ChatMessage[];

  /** Start the WebSocket connection for a place. Returns a cleanup fn. */
  connect: (placeId: string) => () => void;

  // ── Send actions (called by game loop / UI) ─────────────────────────
  sendMove: (x: number, y: number, z: number, rotation: number) => void;
  sendChat: (text: string) => void;
  sendVoice: (data: string, duration: number) => void;
  sendName: (name: string) => void;
}

export const useMetaverseStore = create<MetaverseState>((set, get) => ({
  status: "connecting",
  self: null,
  players: [],
  messages: [],

  // ── Connection ───────────────────────────────────────────────────────

  connect: (placeId: string) => {
    // Close any existing socket
    if (_rws) {
      _rws.close();
      _rws = null;
    }

    // Clear existing timers
    if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = undefined; }
    if (_pongTimer) { clearTimeout(_pongTimer); _pongTimer = undefined; }

    const epoch = ++_epoch;
    set({ status: "connecting" });

    // ── Helpers ──────────────────────────────────────────────────────

    function startHeartbeat() {
      stopHeartbeat();
      _heartbeatTimer = setInterval(() => {
        _sendRaw({ t: "ping" });
        _pongTimer ??= setTimeout(() => _rws?.reconnect(), PONG_TIMEOUT);
      }, HEARTBEAT_INTERVAL);
    }

    function stopHeartbeat() {
      if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = undefined; }
      if (_pongTimer) { clearTimeout(_pongTimer); _pongTimer = undefined; }
    }

    // ── Message handler ──────────────────────────────────────────────

    function handle(msg: ServerMessage) {
      const s = get();

      switch (msg.t) {
        case "welcome": {
          const saved = localStorage.getItem("lambobo-nickname");
          if (saved && saved !== msg.self.name) {
            msg.self.name = saved;
            setTimeout(() => _sendRaw({ t: "rename", name: saved }), 100);
          }
          set({ self: msg.self });

          const map = new Map<string, RemotePlayer>();
          for (const p of msg.peers) {
            map.set(p.id, {
              ...p,
              targetX: p.x,
              targetY: p.y,
              targetZ: p.z,
              targetRotation: p.rotation,
            });
          }
          playerMap.clear();
          for (const [k, v] of map) playerMap.set(k, v);
          set({ players: _syncPlayers() });
          break;
        }
        case "join": {
          const p = msg.peer;
          playerMap.set(p.id, {
            ...p,
            targetX: p.x,
            targetY: p.y,
            targetZ: p.z,
            targetRotation: p.rotation,
          });
          set({ players: _syncPlayers() });
          break;
        }
        case "leave": {
          playerMap.delete(msg.id);
          set({ players: _syncPlayers() });
          break;
        }
        case "move": {
          const p = playerMap.get(msg.id);
          if (p) {
            p.targetX = msg.x;
            p.targetY = msg.y;
            p.targetZ = msg.z;
            p.targetRotation = msg.rotation;
            set({ players: _syncPlayers() });
          }
          break;
        }
        case "chat":
        case "voice": {
          set((state) => ({
            messages: [...state.messages.slice(-99), msg.message],
          }));
          break;
        }
        case "rename": {
          const p = playerMap.get(msg.id);
          if (p) p.name = msg.name;
          const s2 = get();
          if (msg.id === s2.self?.id) {
            set({ self: { ...s2.self, name: msg.name } });
          }
          set({ players: _syncPlayers() });
          break;
        }
        case "pong":
          if (_pongTimer) { clearTimeout(_pongTimer); _pongTimer = undefined; }
          break;
      }
    }

    // ── Connect ───────────────────────────────────────────────────────

    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const rws = new ReconnectingWebSocket(
      `${protocol}://${location.host}/api/ws`,
      [],
      {
        minReconnectionDelay: 5000,
        maxReconnectionDelay: 30000,
        reconnectionDelayGrowFactor: 1.5,
        connectionTimeout: 4000,
      },
    );
    _rws = rws;
    const innerEpoch = epoch;

    rws.addEventListener("open", () => {
      if (_epoch !== innerEpoch) return;
      set({ status: "connected" });
      _sendRaw({ t: "join", placeId });
      startHeartbeat();
    });

    rws.addEventListener("message", (event) => {
      if (_epoch !== innerEpoch) return;
      try {
        handle(JSON.parse(event.data) as ServerMessage);
      } catch { /* ignore */ }
    });

    rws.addEventListener("close", () => {
      if (_epoch !== innerEpoch) return;
      stopHeartbeat();
      set({ status: "disconnected", self: null });
      playerMap.clear();
      set({ players: [] });
    });

    // ── Cleanup ───────────────────────────────────────────────────────

    return () => {
      ++_epoch;
      stopHeartbeat();
      if (_rafId != null) { cancelAnimationFrame(_rafId); _rafId = undefined; }
      if (_rws) {
        _rws.close();
        _rws = null;
      }
      playerMap.clear();
      set({ status: "disconnected", self: null, players: [], messages: [] });
    };
  },

  // ── Send actions ─────────────────────────────────────────────────────

  sendMove: (x: number, y: number, z: number, rotation: number) => {
    _pendingMove = { x, y, z, rotation };
    if (_rafId == null) {
      _rafId = requestAnimationFrame(() => {
        _rafId = undefined;
        const m = _pendingMove;
        if (m) {
          _sendRaw({ t: "move", ...m });
          _pendingMove = null;
        }
      });
    }
  },

  sendChat: (text: string) => {
    _sendRaw({ t: "chat", text });
  },

  sendVoice: (data: string, duration: number) => {
    _sendRaw({ t: "voice", data, duration });
  },

  sendName: (name: string) => {
    localStorage.setItem("lambobo-nickname", name);
    _sendRaw({ t: "rename", name });
  },
}));
