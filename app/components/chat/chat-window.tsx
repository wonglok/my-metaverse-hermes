import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "../../../shared/types/realtime";
import { cn } from "@/lib/utils";
import {
  loadFFmpeg,
  encodeAudioToMp3,
  isFFmpegReady,
  base64ToAudioUrl,
  formatDuration,
} from "@/lib/audio";

let _audioCtx: AudioContext | null = null;
let _currentAudio: HTMLAudioElement | null = null;

function stopAllAudio() {
  // Stop tracked programmatic Audio (not in DOM)
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.src = "";
    _currentAudio = null;
  }
  // Stop any <audio> elements in the DOM
  document.querySelectorAll("audio").forEach((a) => {
    a.pause();
    a.currentTime = 0;
  });
}

function playDing() {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    const ctx = _audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1319, now);
    osc.frequency.setValueAtTime(2093, now + 0.06);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Browser may block audio until user interaction
  }
}

// ── Voice message bubble (inline audio player) ──────────────────────────

function VoiceBubble({
  audioData,
  duration,
  isSelf,
  autoPlay = false,
}: {
  audioData: string;
  duration: number;
  isSelf: boolean;
  autoPlay?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const autoPlayedRef = useRef(false);

  useEffect(() => {
    try {
      const url = base64ToAudioUrl(audioData);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      return; // Invalid audio data
    }
  }, [audioData]);

  // Auto-play voice messages from others
  useEffect(() => {
    if (!audioUrl || !autoPlay || autoPlayedRef.current) return;
    autoPlayedRef.current = true;

    // Stop any other playing audio first
    stopAllAudio();

    const audio = new Audio(audioUrl);
    _currentAudio = audio;
    audioRef.current = audio;
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setCurrentTime(0);
      cancelAnimationFrame(rafRef.current);
      _currentAudio = null;
    });
    audio.addEventListener("error", () => {
      setPlaying(false);
      _currentAudio = null;
    });

    audio
      .play()
      .then(() => {
        setPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        // Browser blocked autoplay — user can tap play manually
      });
  }, [audioUrl, autoPlay]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        if (_currentAudio === audioRef.current) _currentAudio = null;
      }
    };
  }, []);

  const stopAndReset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const tick = useCallback(() => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  function togglePlay() {
    if (!audioUrl) return;

    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      stopAndReset();
      return;
    }

    // Stop any other playing audio
    stopAllAudio();

    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audio.addEventListener("ended", () => {
        setPlaying(false);
        setCurrentTime(0);
        cancelAnimationFrame(rafRef.current);
        _currentAudio = null;
      });
      audio.addEventListener("error", () => {
        setPlaying(false);
        _currentAudio = null;
      });
      audioRef.current = audio;
    }

    _currentAudio = audioRef.current;
    audioRef.current.play().catch(() => {
      setPlaying(false);
      _currentAudio = null;
    });
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button
        onClick={togglePlay}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full transition",
          isSelf
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-foreground/10 text-foreground",
        )}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 rounded-full bg-black/20 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-100",
            isSelf ? "bg-primary-foreground/60" : "bg-foreground/40",
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <span
        className={cn(
          "text-[11px] tabular-nums shrink-0",
          isSelf ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {formatDuration(playing ? currentTime : duration)}
      </span>
    </div>
  );
}

// ── Recording state machine ──────────────────────────────────────────────

type RecState =
  | { phase: "idle" }
  | { phase: "recording"; startedAt: number }
  | { phase: "encoding" };

// ── Chat window ──────────────────────────────────────────────────────────

interface ChatWindowProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onSendVoice: (data: string, duration: number) => void;
  selfId: string | null;
}

const MAX_RECORD_SECS = 60;

export function ChatWindow({
  messages,
  onSend,
  onSendVoice,
  selfId,
}: ChatWindowProps) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [recState, setRecState] = useState<RecState>({ phase: "idle" });
  const [recElapsed, setRecElapsed] = useState(0);

  const prevLenRef = useRef(messages.length);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recIntervalRef = useRef<number>(0);
  const recElapsedRef = useRef(0);
  const micSupported = typeof MediaRecorder !== "undefined";
  const [ffmpegReady, setFFmpegReady] = useState(false);

  // Eagerly load ffmpeg.wasm so it's ready when the user records
  useEffect(() => {
    if (!micSupported) return;
    loadFFmpeg()
      .then(() => setFFmpegReady(true))
      .catch(() => {}); // Will retry on first record attempt
  }, [micSupported]);

  // Track unread messages + play ding for new ones
  useEffect(() => {
    const newMessages = messages.slice(prevLenRef.current);
    prevLenRef.current = messages.length;
    if (newMessages.length === 0) return;
    if (!open) setUnread((n) => n + newMessages.length);
    const hasIncoming = newMessages.some((m) => m.peerId !== selfId);
    if (hasIncoming) playDing();
  }, [messages, open, selfId]);

  // Reset unread when opening
  function toggleOpen() {
    setOpen((prev) => {
      if (!prev) setUnread(0);
      return !prev;
    });
  }

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Voice recording ──────────────────────────────────────────────────

  async function startRecording() {
    if (!micSupported) return;

    // Ensure ffmpeg is loaded before recording
    if (!isFFmpegReady()) {
      try {
        await loadFFmpeg();
        setFFmpegReady(true);
      } catch {
        return; // ffmpeg failed to load, can't encode
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
        // Stop all tracks
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
          setRecState({ phase: "idle" });
          setRecElapsed(0);
          return;
        }

        setRecState({ phase: "idle" });
        setRecElapsed(0);
      };

      recorder.start(250); // collect chunks every 250ms
      mediaRecorderRef.current = recorder;

      const startedAt = Date.now();
      setRecState({ phase: "recording", startedAt });
      setRecElapsed(0);

      // Tick every 100ms for elapsed counter
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
        // Cancel — discard chunks and stop
        chunksRef.current = [];
        const stream = mediaRecorderRef.current.stream;
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
        setRecState({ phase: "idle" });
        setRecElapsed(0);
      }
    } else {
      setRecState({ phase: "idle" });
      setRecElapsed(0);
    }
  }

  // Cleanup recorder on unmount
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

  return (
    <>
      {/* Floating toggle button */}
      <button
        className={cn(
          "fixed top-12 right-2 z-[99999999] flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105",
          "",
        )}
        onClick={toggleOpen}
        aria-label="Toggle chat"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed top-20 right-4 z-40 flex flex-col overflow-hidden rounded-xl border bg-card shadow-2xl transition-all duration-200",
          "max-sm:bottom-20 max-sm:right-0 max-sm:left-0 max-sm:rounded-b-none max-sm:rounded-t-xl",
          open
            ? "max-sm:h-[60vh] h-[520px] w-[380px] max-sm:w-full opacity-100"
            : "h-0 w-0 opacity-0 pointer-events-none",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Chat</h3>
          <button
            onClick={() => setOpen(false)}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            aria-label="Close chat"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No messages yet. Say hello!
            </p>
          )}
          {messages.map((m) => {
            const isSelf = m.peerId === selfId;
            const isVoice = !!m.audioData;

            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col",
                  isSelf ? "items-end" : "items-start",
                )}
              >
                <span
                  className="mb-0.5 text-[10px] font-medium"
                  style={{ color: m.color }}
                >
                  {isSelf ? "You" : m.name}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-1.5 text-sm break-words",
                    isSelf
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {isVoice && m.audioData && m.audioDuration ? (
                    <VoiceBubble
                      audioData={m.audioData}
                      duration={m.audioDuration}
                      isSelf={isSelf}
                      autoPlay={!isSelf}
                    />
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        {isEncoding ? (
          <div className="flex items-center gap-2 border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Encoding audio...
            </span>
          </div>
        ) : isRecording ? (
          <div className="flex items-center gap-2 border-t px-3 py-2">
            {/* Cancel button */}
            <button
              onClick={() => stopRecording(false)}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
              aria-label="Cancel recording"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Recording indicator */}
            <div className="flex flex-1 items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-sm font-mono tabular-nums text-muted-foreground">
                {formatDuration(recElapsed)}
              </span>
            </div>

            {/* Send button */}
            <button
              onClick={() => stopRecording(true)}
              disabled={recElapsed < 0.5}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40 hover:opacity-90"
              aria-label="Send voice message"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex gap-2 border-t px-3 py-2">
            <input
              onKeyDownCapture={(ev) => {
                if (ev.key === "Enter") {
                  setTimeout(() => setText(""));
                } else {
                  ev.stopPropagation();
                }
              }}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message..."
              maxLength={500}
              className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring text-[17px]"
            />
            {micSupported && (
              <button
                onClick={startRecording}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted-foreground/15 transition"
                aria-label="Record voice message"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition disabled:opacity-40 hover:opacity-90"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </>
  );
}
