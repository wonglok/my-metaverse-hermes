import { FFmpeg } from "@ffmpeg/ffmpeg";
import path from "path";

let ffmpeg: FFmpeg | null = null;
let ffmpegLoading: Promise<void> | null = null;

/** Load ffmpeg.wasm (once). Call freely — subsequent calls are no-ops. */
export async function loadFFmpeg(): Promise<void> {
  if (ffmpeg?.loaded) return;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpeg = new FFmpeg();
  ffmpegLoading = ffmpeg
    .load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      wasmURL:
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
      // coreURL: path.join(location.origin, "./vendor/ffmpeg/ffmpeg-core.js"),
      // wasmURL: path.join(location.origin, "./vendor/ffmpeg/ffmpeg-core.wasm"),
    })
    .then(() => {
      ffmpegLoading = null;
    });

  return ffmpegLoading;
}

export function isFFmpegReady(): boolean {
  return ffmpeg?.loaded ?? false;
}

/**
 * Encode an audio blob (WebM/Opus from MediaRecorder) to low-bitrate MP3.
 * Returns base64-encoded MP3 data and the original duration in seconds.
 */
export async function encodeAudioToMp3(
  blob: Blob,
): Promise<{ base64: string; duration: number }> {
  if (!ffmpeg?.loaded) {
    throw new Error("ffmpeg not loaded — call loadFFmpeg() first");
  }

  // Read blob as Uint8Array for ffmpeg virtual filesystem
  const arrayBuf = await blob.arrayBuffer();
  const inputData = new Uint8Array(arrayBuf);

  const inputName = `input_${Date.now()}.webm`;
  const outputName = `output_${Date.now()}.mp3`;

  await ffmpeg.writeFile(inputName, inputData);

  // Low-bitrate mono MP3 tuned for voice — ~16kbps
  await ffmpeg.exec([
    "-i",
    inputName,
    "-b:a",
    "16k",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "mp3",
    outputName,
  ]);

  const mp3Data = (await ffmpeg.readFile(outputName)) as Uint8Array;

  // Cleanup virtual filesystem
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  // Estimate duration from blob size / bitrate (approximate)
  const duration = blob.size > 0 ? (blob.size * 8) / 16000 : 1;

  return { base64: uint8ToBase64(mp3Data), duration };
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Convert Uint8Array to base64 string (chunked to avoid stack overflow). */
function uint8ToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.byteLength; i += 8192) {
    binary += String.fromCharCode(...Array.from(data.subarray(i, i + 8192)));
  }
  return btoa(binary);
}

/** Convert a base64 MP3 string to a playable Blob URL. */
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
