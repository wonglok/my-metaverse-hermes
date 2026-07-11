const CACHE_DIR = "thumbnails";

async function hashUrl(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCachedThumbnail(url: string): Promise<string | null> {
  try {
    const hash = await hashUrl(url);
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(CACHE_DIR, { create: true });
    const fileHandle = await dir.getFileHandle(hash);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

export async function cacheThumbnail(url: string, blob: Blob): Promise<void> {
  try {
    const hash = await hashUrl(url);
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(CACHE_DIR, { create: true });
    const fileHandle = await dir.getFileHandle(hash, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch {
    // OPFS unavailable or quota exceeded — skip caching
  }
}
