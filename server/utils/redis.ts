import Redis from "ioredis";
import type { ServerMessage } from "../../shared/types/realtime";

const REDIS_URL = process.env.METAVERSE_REDIS_URL;
const CHANNEL = "metaverse:events";

const instanceId =
  Math.random().toString(36).slice(2, 8) +
  "_" +
  Date.now().toString(36).slice(-4);

interface RedisMessage {
  iid: string; // instanceId — skip if from self
  pid: string; // placeId
  p: ServerMessage; // payload
}

let pub: Redis | null = null;
let sub: Redis | null = null;

function getClients(): { pub: Redis; sub: Redis } | null {
  if (!REDIS_URL) return null;
  if (!pub || !sub) {
    pub = new Redis(REDIS_URL, { lazyConnect: true });
    sub = new Redis(REDIS_URL, { lazyConnect: true });
    pub.connect().catch(() => {});
    sub.connect().catch(() => {});
  }
  return { pub: pub!, sub: sub! };
}

/** Publish a server message to Redis so other instances can rebroadcast it. */
export function publishEvent(placeId: string, payload: ServerMessage): void {
  const clients = getClients();
  if (!clients) return;
  const msg: RedisMessage = { iid: instanceId, pid: placeId, p: payload };
  clients.pub.publish(CHANNEL, JSON.stringify(msg)).catch(() => {});
}

/**
 * Subscribe to Redis events. The callback receives `(placeId, payload)` for
 * events originating from other server instances. Returns an unsubscribe fn.
 */
export function subscribeEvents(
  cb: (placeId: string, payload: ServerMessage) => void,
): () => void {
  const clients = getClients();
  if (!clients) return () => {};

  const handler = (_channel: string, message: string) => {
    try {
      const data = JSON.parse(message) as RedisMessage;
      if (data.iid === instanceId) return;
      cb(data.pid, data.p);
    } catch {
      // ignore malformed messages
    }
  };

  clients.sub.subscribe(CHANNEL).catch(() => {});
  clients.sub.on("message", handler);

  return () => {
    clients.sub?.off("message", handler);
    clients.sub?.unsubscribe(CHANNEL).catch(() => {});
  };
}
