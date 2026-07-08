import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "../../../shared/types/realtime";
import { cn } from "@/lib/utils";

let _audioCtx: AudioContext | null = null;

function playDing() {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    const ctx = _audioCtx;
    const now = ctx.currentTime;

    // Two quick sine tones: E6 → C7, short and clean
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1319, now); // E6
    osc.frequency.setValueAtTime(2093, now + 0.06); // C7
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Browser may block audio until user interaction
  }
}

interface ChatWindowProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  selfId: string | null;
}

export function ChatWindow({ messages, onSend, selfId }: ChatWindowProps) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevLenRef = useRef(messages.length);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track unread messages + play ding for new ones
  useEffect(() => {
    const newMessages = messages.slice(prevLenRef.current);
    prevLenRef.current = messages.length;

    if (newMessages.length === 0) return;

    // Count unread if chat is closed
    if (!open) {
      setUnread((n) => n + newMessages.length);
    }

    // Play a ding for messages from others (not self)
    const hasIncoming = newMessages.some((m) => m.peerId !== selfId);
    if (hasIncoming) {
      playDing();
    }
  }, [messages, open, selfId]);

  // Reset unread when opening the chat
  function toggleOpen() {
    setOpen((prev) => {
      if (!prev) setUnread(0);
      return !prev;
    });
  }

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

  return (
    <>
      {/* Floating toggle button (desktop) / bottom bar (mobile) */}
      <button
        className={cn(
          "fixed top-12 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105",
          "md:bottom-4 md:right-4",
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
          "fixed bottom-20 right-4 z-40 flex flex-col overflow-hidden rounded-xl border bg-card shadow-2xl transition-all duration-200",
          // Mobile: full-width tabs style at bottom
          "max-sm:bottom-0 max-sm:right-0 max-sm:left-0 max-sm:rounded-b-none max-sm:rounded-t-xl",
          open
            ? "max-sm:h-[60vh] h-[420px] w-[340px] max-sm:w-full opacity-100"
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
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 border-t px-3 py-2">
          <input
            onKeyDownCapture={(ev) => {
              if (ev.key === "Enter") {
                setTimeout(() => {
                  setText("");
                });
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
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition disabled:opacity-40 hover:opacity-90"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
