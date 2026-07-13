import { defineWebSocketHandler } from "nitro";
import type {
  PlayerState,
  Peer,
  ServerMessage,
  ClientMessage,
  ChatMessage,
} from "../../shared/types/realtime";
import { createIdentity } from "../utils/identity";
import { publishEvent, subscribeEvents } from "../utils/redis";

/** Map of placeId → Map<peerId, PlayerState> */
const rooms = new Map<string, Map<string, PlayerState>>();

/** Reverse lookup: peer.id → placeId */
const peerRoom = new Map<string, string>();

/** Local peers in each room — used for Redis rebroadcast */
const roomPeers = new Map<
  string,
  Set<{ send: (data: string) => void; id: string }>
>();

/** Next monotonic id for chat messages. */
let chatSeq = 0;

// ── Redis cross-instance relay ───────────────────────────────────────────

const unsubRedis = await subscribeEvents((placeId, payload) => {
  const peers = roomPeers.get(placeId);
  if (!peers || peers.size === 0) return;

  const raw = JSON.stringify(payload);

  // Handle room state sync for join/leave events from other instances
  if (payload.t === "join") {
    if (!rooms.has(placeId)) rooms.set(placeId, new Map());
    rooms.get(placeId)!.set(payload.peer.id, { ...payload.peer });
  } else if (payload.t === "leave") {
    rooms.get(placeId)?.delete(payload.id);
    if (rooms.get(placeId)?.size === 0) rooms.delete(placeId);
  }

  // Rebroadcast to all local peers in the room
  for (const peer of peers) {
    peer.send(raw);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────

function send(peer: { send: (data: string) => void }, msg: ServerMessage) {
  peer.send(JSON.stringify(msg));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function broadcastLocal(placeId: string, message: ServerMessage) {
  const peers = roomPeers.get(placeId);
  if (!peers) return;
  const raw = JSON.stringify(message);
  for (const peer of peers) {
    peer.send(raw);
  }
}

// ── Handler ──────────────────────────────────────────────────────────────

export default defineWebSocketHandler({
  open(peer) {
    const identity = createIdentity();
    peer.context.identity = identity;
  },

  message(peer, message) {
    const identity = peer.context.identity as Peer | undefined;
    if (!identity) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message.text()) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.t) {
      case "join": {
        const placeId = String(msg.placeId || "default");

        // Leave previous room if any.
        const prevRoom = peerRoom.get(identity.id);
        if (prevRoom && prevRoom !== placeId) {
          leaveRoom(identity.id, prevRoom);
        }

        peerRoom.set(identity.id, placeId);
        peer.subscribe(placeId);

        // Track local peer for Redis rebroadcast
        if (!roomPeers.has(placeId)) roomPeers.set(placeId, new Set());
        roomPeers
          .get(placeId)!
          .add({ send: (d) => peer.send(d), id: identity.id });

        if (!rooms.has(placeId)) rooms.set(placeId, new Map());

        const playerState: PlayerState = {
          id: identity.id,
          name: identity.name,
          color: identity.color,
          x: clamp(Math.random() * 10 - 5, -50, 50),
          y: 0,
          z: clamp(Math.random() * 10 - 5, -50, 50),
          rotation: 0,
          avatarUrl: msg.avatarUrl,
        };
        rooms.get(placeId)!.set(identity.id, playerState);

        // Send welcome with all known peers (local + from other instances)
        const peers: PlayerState[] = [];
        for (const [id, ps] of rooms.get(placeId)!) {
          if (id !== identity.id) peers.push({ ...ps });
        }

        send(peer, { t: "welcome", self: identity, peers });

        // Broadcast join to other local peers (excludes sender) + Redis
        const joinMsg: ServerMessage = { t: "join", peer: playerState };
        peer.publish(placeId, JSON.stringify(joinMsg));
        publishEvent(placeId, joinMsg);
        break;
      }

      case "move": {
        const placeId = peerRoom.get(identity.id);
        if (!placeId) return;

        const room = rooms.get(placeId);
        if (!room) return;

        const state = room.get(identity.id);
        if (!state) return;

        const x = msg.x;
        const y = msg.y;
        const z = msg.z;
        const rotation = clamp(msg.rotation ?? 0, -Math.PI * 4, Math.PI * 4);

        state.x = x;
        state.y = y;
        state.z = z;
        state.rotation = rotation;
        if (msg.avatarUrl) state.avatarUrl = msg.avatarUrl;

        const moveMsg: ServerMessage = {
          t: "move",
          id: identity.id,
          x,
          y,
          z,
          rotation,
          avatarUrl: msg.avatarUrl || state.avatarUrl,
        };

        peer.publish(placeId, JSON.stringify(moveMsg));
        publishEvent(placeId, moveMsg);
        break;
      }

      case "chat": {
        const placeId = peerRoom.get(identity.id);
        if (!placeId) return;

        const text = String(msg.text || "")
          .trim()
          .slice(0, 500);
        if (!text) return;

        const chatMsg: ChatMessage = {
          id: `chat_${chatSeq++}`,
          peerId: identity.id,
          name: identity.name,
          color: identity.color,
          text,
          timestamp: Date.now(),
        };

        const chatPayload: ServerMessage = { t: "chat", message: chatMsg };

        // Echo back to sender
        send(peer, chatPayload);

        // Broadcast to other local peers (excludes sender) + Redis
        peer.publish(placeId, JSON.stringify(chatPayload));
        publishEvent(placeId, chatPayload);
        break;
      }

      case "voice": {
        const placeId = peerRoom.get(identity.id);
        if (!placeId) return;

        const data = String(msg.data || "").slice(0, 800_000); // ~600KB MP3
        const duration = Math.min(60, Math.max(0, Number(msg.duration) || 0));
        if (!data || duration <= 0) return;

        const voiceMsg: ChatMessage = {
          id: `chat_${chatSeq++}`,
          peerId: identity.id,
          name: identity.name,
          color: identity.color,
          audioData: data,
          audioDuration: duration,
          timestamp: Date.now(),
        };

        const voicePayload: ServerMessage = { t: "voice", message: voiceMsg };

        // Echo back to sender
        send(peer, voicePayload);

        // Broadcast to other local peers (excludes sender) + Redis
        peer.publish(placeId, JSON.stringify(voicePayload));
        publishEvent(placeId, voicePayload);
        break;
      }

      case "rename": {
        const newName = String(msg.name || "")
          .trim()
          .slice(0, 24);
        if (!newName) return;

        identity.name = newName;

        const placeId = peerRoom.get(identity.id);
        if (!placeId) return;

        const state = rooms.get(placeId)?.get(identity.id);
        if (state) state.name = newName;

        const renameMsg: ServerMessage = {
          t: "rename",
          id: identity.id,
          name: newName,
        };

        send(peer, renameMsg);
        peer.publish(placeId, JSON.stringify(renameMsg));
        publishEvent(placeId, renameMsg);
        break;
      }

      case "avatar": {
        const placeId = peerRoom.get(identity.id);
        if (!placeId) return;

        const avatarUrl = String(msg.url || "").slice(0, 2048);
        if (!avatarUrl) return;

        const state = rooms.get(placeId)?.get(identity.id);
        if (state) state.avatarUrl = avatarUrl;

        const avatarMsg: ServerMessage = {
          t: "avatar",
          id: identity.id,
          avatarUrl,
        };

        peer.publish(placeId, JSON.stringify(avatarMsg));
        publishEvent(placeId, avatarMsg);
        break;
      }

      case "ping":
        send(peer, { t: "pong" });
        break;
    }
  },

  close(peer) {
    const identity = peer.context.identity as Peer | undefined;
    if (identity) {
      const placeId = peerRoom.get(identity.id);
      if (placeId) leaveRoom(identity.id, placeId);
    }
  },

  error(peer, error) {
    console.error("[realtime] ws error", peer.id, error);
    const identity = peer.context.identity as Peer | undefined;
    if (identity) {
      const placeId = peerRoom.get(identity.id);
      if (placeId) leaveRoom(identity.id, placeId);
    }
  },
});

// ── Room leave helper (shared by close / error / room-switch) ────────────

function leaveRoom(peerId: string, placeId: string) {
  rooms.get(placeId)?.delete(peerId);
  if (rooms.get(placeId)?.size === 0) rooms.delete(placeId);

  // Remove from local peer tracking
  const peers = roomPeers.get(placeId);
  if (peers) {
    for (const p of peers) {
      if (p.id === peerId) {
        peers.delete(p);
        break;
      }
    }
    if (peers.size === 0) roomPeers.delete(placeId);
  }

  peerRoom.delete(peerId);

  const leaveMsg: ServerMessage = { t: "leave", id: peerId };
  broadcastLocal(placeId, leaveMsg);
  publishEvent(placeId, leaveMsg);
}
