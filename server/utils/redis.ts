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

// Lazy-loaded ioredis — only imported when METAVERSE_REDIS_URL is set.
let _module: typeof import("ioredis") | null = null;
async function getIoredis(): Promise<typeof import("ioredis") | null> {
  if (!REDIS_URL) return null;
  if (_module) return _module;
  try {
    _module = await import("ioredis");
    return _module;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pub: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sub: any = null;

async function getClients(): Promise<{ pub: any; sub: any } | null> {
  if (!REDIS_URL) return null;
  if (pub && sub) return { pub, sub };

  const ioredis = await getIoredis();
  if (!ioredis) return null;

  if (!pub) {
    pub = new ioredis.default(REDIS_URL, { lazyConnect: true });
    pub.connect().catch(() => {});
  }
  if (!sub) {
    sub = new ioredis.default(REDIS_URL, { lazyConnect: true });
    sub.connect().catch(() => {});
  }
  return { pub, sub };
}

/** Publish a server message to Redis so other instances can rebroadcast it. */
export async function publishEvent(
  placeId: string,
  payload: ServerMessage,
): Promise<void> {
  const clients = await getClients();
  if (!clients) return;
  const msg: RedisMessage = { iid: instanceId, pid: placeId, p: payload };
  clients.pub.publish(CHANNEL, JSON.stringify(msg)).catch(() => {});
}

/**
 * Subscribe to Redis events. The callback receives `(placeId, payload)` for
 * events originating from other server instances. Returns an unsubscribe fn.
 */
export async function subscribeEvents(
  cb: (placeId: string, payload: ServerMessage) => void,
): Promise<() => void> {
  const clients = await getClients();
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
