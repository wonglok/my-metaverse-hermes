import { defineWebSocketHandler } from "nitro";
import type {
  PlayerState,
  Peer,
  ServerMessage,
  ClientMessage,
  ChatMessage,
} from "../../shared/types/realtime";
import { createIdentity } from "../utils/identity";

/** Map of placeId → Map<peerId, PlayerState> */
const rooms = new Map<string, Map<string, PlayerState>>();

/** Reverse lookup: peer.id → placeId */
const peerRoom = new Map<string, string>();

/** Next monotonic id for chat messages. */
let chatSeq = 0;

function send(peer: { send: (data: string) => void }, msg: ServerMessage) {
  peer.send(JSON.stringify(msg));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export default defineWebSocketHandler({
  open(peer) {
    const identity = createIdentity();
    peer.context.identity = identity;
    // Room subscription happens on the join message, not on open.
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
          rooms.get(prevRoom)?.delete(identity.id);
          peer.unsubscribe(prevRoom);
          peer.publish(
            prevRoom,
            JSON.stringify({
              t: "leave",
              id: identity.id,
            } satisfies ServerMessage),
          );
        }

        peerRoom.set(identity.id, placeId);
        peer.subscribe(placeId);

        if (!rooms.has(placeId)) rooms.set(placeId, new Map());

        const playerState: PlayerState = {
          id: identity.id,
          name: identity.name,
          color: identity.color,
          x: clamp(Math.random() * 10 - 5, -50, 50),
          y: 0,
          z: clamp(Math.random() * 10 - 5, -50, 50),
          rotation: 0,
        };
        rooms.get(placeId)!.set(identity.id, playerState);

        const peers: PlayerState[] = [];
        for (const [id, ps] of rooms.get(placeId)!) {
          if (id !== identity.id) peers.push({ ...ps });
        }

        send(peer, { t: "welcome", self: identity, peers });
        peer.publish(
          placeId,
          JSON.stringify({
            t: "join",
            peer: playerState,
          } satisfies ServerMessage),
        );
        break;
      }

      case "move": {
        const placeId = peerRoom.get(identity.id);
        if (!placeId) return;

        const room = rooms.get(placeId);
        if (!room) return;

        const state = room.get(identity.id);
        if (!state) return;

        const x = msg.x; // clamp(, -1000, 1000);
        const y = msg.y; //clamp(msg.y ?? 0, -1000, 1000);
        const z = msg.z; // clamp(msg.z, -1000, 1000);
        const rotation = clamp(msg.rotation ?? 0, -Math.PI * 4, Math.PI * 4);

        state.x = x;
        state.y = y;
        state.z = z;
        state.rotation = rotation;

        peer.publish(
          placeId,
          JSON.stringify({
            t: "move",
            id: identity.id,
            x,
            y,
            z,
            rotation,
          } satisfies ServerMessage),
        );
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

        const payload = JSON.stringify({
          t: "chat",
          message: chatMsg,
        } satisfies ServerMessage);

        // Echo back to sender so they see their own message immediately
        send(peer, { t: "chat", message: chatMsg });

        // Broadcast to all other peers in the room
        peer.publish(placeId, payload);
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

        // Update name in room state
        const state = rooms.get(placeId)?.get(identity.id);
        if (state) state.name = newName;

        const payload = JSON.stringify({
          t: "rename",
          id: identity.id,
          name: newName,
        } satisfies ServerMessage);

        send(peer, { t: "rename", id: identity.id, name: newName });
        peer.publish(placeId, payload);
        break;
      }

      case "ping":
        send(peer, { t: "pong" });
        break;
    }
  },

  close(peer) {
    const identity = peer.context.identity as Peer | undefined;
    if (!identity) return;

    const placeId = peerRoom.get(identity.id);
    if (placeId) {
      rooms.get(placeId)?.delete(identity.id);
      if (rooms.get(placeId)?.size === 0) rooms.delete(placeId);
      peer.publish(
        placeId,
        JSON.stringify({ t: "leave", id: identity.id } satisfies ServerMessage),
      );
    }
    peerRoom.delete(identity.id);
  },

  error(peer, error) {
    console.error("[realtime] ws error", peer.id, error);
    const identity = peer.context.identity as Peer | undefined;
    if (!identity) return;

    const placeId = peerRoom.get(identity.id);
    if (placeId) {
      rooms.get(placeId)?.delete(identity.id);
      if (rooms.get(placeId)?.size === 0) rooms.delete(placeId);
      peer.publish(
        placeId,
        JSON.stringify({ t: "leave", id: identity.id } satisfies ServerMessage),
      );
    }
    peerRoom.delete(identity.id);
  },
});
