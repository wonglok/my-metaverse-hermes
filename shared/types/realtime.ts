/**
 * Wire protocol shared between the browser client and the WebSocket server.
 * 3D multiplayer metaverse: player positions, chat, and room-based routing.
 */

/** A connected participant. */
export interface Peer {
  id: string;
  name: string;
  /** A CSS color (hsl) used for the avatar tint and label. */
  color: string;
}

/** 3D position + rotation for player avatars. */
export interface PlayerState {
  id: string;
  name: string;
  color: string;
  /** World-space position. */
  x: number;
  y: number;
  z: number;
  /** Y-axis rotation in radians. */
  rotation: number;
  /** Avatar VRM model URL. */
  avatarUrl?: string;
}

/** A chat message (text, voice, or both). */
export interface ChatMessage {
  id: string;
  peerId: string;
  name: string;
  color: string;
  text?: string;
  /** Base64-encoded MP3 audio data for voice messages. */
  audioData?: string;
  /** Audio duration in seconds. */
  audioDuration?: number;
  timestamp: number;
}

// ── Client → Server ──────────────────────────────────────────────────────────

export type ClientMessage =
  | { t: "join"; placeId: string; avatarUrl?: string }
  | { t: "move"; x: number; y: number; z: number; rotation: number }
  | { t: "chat"; text: string }
  | { t: "voice"; data: string; duration: number }
  | { t: "rename"; name: string }
  | { t: "avatar"; url: string }
  | { t: "ping" }
  // Legacy — kept for backward compatibility with the original live-canvas demo.
  | { t: "cursor"; x: number; y: number }
  | { t: "reaction"; emoji: string; x: number; y: number };

// ── Server → Client ──────────────────────────────────────────────────────────

export type ServerMessage =
  | { t: "welcome"; self: Peer; peers: PlayerState[] }
  | { t: "join"; peer: PlayerState }
  | { t: "leave"; id: string }
  | { t: "move"; id: string; x: number; y: number; z: number; rotation: number }
  | { t: "chat"; message: ChatMessage }
  | { t: "voice"; message: ChatMessage }
  | { t: "rename"; id: string; name: string }
  | { t: "avatar"; id: string; avatarUrl: string }
  | { t: "pong" }
  // Legacy
  | { t: "cursor"; id: string; x: number; y: number }
  | { t: "reaction"; id: string; emoji: string; x: number; y: number };

export const REACTIONS = ["🎉", "❤️", "😮", "👍", "🔥", "✨"] as const;
export type Reaction = (typeof REACTIONS)[number];
