import { Mp3Encoder } from "lamejs";

/** Convert Float32Array audio samples (-1..1) to Int16Array (-32768..32767). */
function floatToInt16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Convert Uint8Array to base64 string (chunked to avoid stack overflow). */
function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.byteLength; i += 8192) {
    binary += String.fromCharCode(
      ...Array.from(data.subarray(i, i + 8192)),
    );
  }
  return btoa(binary);
}

/**
 * Encode an audio blob (WebM/Opus from MediaRecorder) to MP3 base64.
 * Returns the base64-encoded MP3 data and the duration in seconds.
 */
export async function encodeAudioToMp3(
  blob: Blob,
): Promise<{ base64: string; duration: number }> {
  const audioCtx = new AudioContext();
  const arrayBuf = await blob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;
  const duration = audioBuffer.duration;

  const encoder = new Mp3Encoder(channels, sampleRate, 64);
  const sampleSize = 1152;

  const left = audioBuffer.getChannelData(0);
  const right = channels > 1 ? audioBuffer.getChannelData(1) : null;

  const chunks: Int8Array[] = [];

  for (let i = 0; i < left.length; i += sampleSize) {
    const leftChunk = floatToInt16(left.subarray(i, i + sampleSize));
    const rightChunk = right
      ? floatToInt16(right.subarray(i, i + sampleSize))
      : undefined;
    const encoded = encoder.encodeBuffer(leftChunk, rightChunk as Int16Array);
    if (encoded.length > 0) chunks.push(encoded);
  }

  const final = encoder.flush();
  if (final.length > 0) chunks.push(final);

  audioCtx.close();

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }

  return { base64: uint8ToBase64(result), duration };
}

/**
 * Convert a base64 MP3 string to a playable Blob URL.
 */
export function base64ToAudioUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "audio/mp3" }));
}

/** Format seconds as m:ss or 0:ss. */
export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
