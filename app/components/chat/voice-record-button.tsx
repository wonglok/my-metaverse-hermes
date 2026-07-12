import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { loadFFmpeg, encodeAudioToMp3, isFFmpegReady } from "@/lib/audio";

type RecState =
  | { phase: "idle" }
  | { phase: "recording"; startedAt: number }
  | { phase: "encoding" };

const MAX_RECORD_SECS = 60;

interface VoiceRecordButtonProps {
  onSendVoice: (data: string, duration: number) => void;
}

export function VoiceRecordButton({ onSendVoice }: VoiceRecordButtonProps) {
  const [recState, setRecState] = useState<RecState>({ phase: "idle" });
  const [recElapsed, setRecElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recIntervalRef = useRef<number>(0);
  const recElapsedRef = useRef(0);
  const micSupported = typeof MediaRecorder !== "undefined";

  // Eagerly load ffmpeg
  useEffect(() => {
    if (!micSupported) return;
    loadFFmpeg().catch(() => {});
  }, [micSupported]);

  async function startRecording() {
    if (!micSupported) return;

    if (!isFFmpegReady()) {
      try {
        await loadFFmpeg();
      } catch {
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        if (chunksRef.current.length === 0) {
          setRecState({ phase: "idle" });
          return;
        }

        setRecState({ phase: "encoding" });

        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const { base64 } = await encodeAudioToMp3(blob);
          const duration = recElapsedRef.current;
          onSendVoice(base64, duration);
        } catch (err) {
          console.error("Voice encoding failed:", err);
        }

        setRecState({ phase: "idle" });
        setRecElapsed(0);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;

      const startedAt = Date.now();
      setRecState({ phase: "recording", startedAt });
      setRecElapsed(0);

      recIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        recElapsedRef.current = elapsed;
        setRecElapsed(elapsed);
        if (elapsed >= MAX_RECORD_SECS) {
          stopRecording(true);
        }
      }, 100);
    } catch {
      // Permission denied or no mic
    }
  }

  function stopRecording(send: boolean) {
    window.clearInterval(recIntervalRef.current);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      if (send) {
        mediaRecorderRef.current.stop();
      } else {
        chunksRef.current = [];
        const stream = mediaRecorderRef.current.stream;
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
        setRecState({ phase: "idle" });
        setRecElapsed(0);
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.clearInterval(recIntervalRef.current);
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        chunksRef.current = [];
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const isRecording = recState.phase === "recording";
  const isEncoding = recState.phase === "encoding";

  function handlePress() {
    if (isRecording) {
      stopRecording(true);
    } else if (!isEncoding) {
      startRecording();
    }
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  if (!micSupported) return null;

  return (
    <button
      onClick={handlePress}
      disabled={isEncoding}
      className={cn(
        "relative flex items-center justify-center shadow-lg transition-all duration-200",
        isRecording
          ? "size-16 bg-red-500 hover:bg-red-600 scale-110 rounded-full"
          : "size-14 rounded-2xl bg-black/30 backdrop-blur-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/[0.08] hover:border-white/[0.12]",
        isEncoding && "opacity-50",
      )}
      aria-label={isRecording ? "Stop and send" : "Record voice message"}
    >
      {isEncoding ? (
        <svg
          className="animate-spin size-6 text-white"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-30"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      ) : isRecording ? (
        <>
          {/* Pulsing ring */}
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
          {/* Timer */}
          <span className="relative text-white text-xs font-mono tabular-nums font-semibold">
            {formatTime(recElapsed)}
          </span>
        </>
      ) : (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      )}
    </button>
  );
}
