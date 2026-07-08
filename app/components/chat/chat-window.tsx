import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "../../../shared/types/realtime";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  selfId: string | null;
}

export function ChatWindow({ messages, onSend, selfId }: ChatWindowProps) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
          "fixed bottom-4 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105",
          "md:bottom-4 md:right-4",
        )}
        onClick={() => setOpen(!open)}
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
        {messages.length > 0 && (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {messages.length > 9 ? "9+" : messages.length}
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
            className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
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
