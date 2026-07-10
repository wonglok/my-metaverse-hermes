import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useMetaverseStore } from "@/stores/metaverse";
import { GameWorld } from "@/components/metaverse/world";
import { ChatWindow } from "@/components/chat/chat-window";
import { VoiceRecordButton } from "@/components/chat/voice-record-button";

function NameEditor({
  name,
  onSave,
}: {
  name: string;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    }
    setEditing(false);
    setValue(name);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 24))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
          }
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
        onKeyDownCapture={(ev) => {
          if (ev.key === "Enter") {
            return;
          }
          ev.stopPropagation();
        }}
        className="w-24 rounded bg-black/40 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-white/30 text-[17px]"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="cursor-pointer rounded px-1 -mx-1 text-xs text-white/80 hover:bg-white/10 hover:text-white transition"
      title="Click to change name"
    >
      {name}
    </button>
  );
}

export function GamePage() {
  const { placeId } = useParams<{ placeId: string }>();
  const navigate = useNavigate();
  const pid = placeId ?? "default";

  // Connect the WebSocket for this place
  useEffect(() => {
    return useMetaverseStore.getState().connect(pid);
  }, [pid]);

  // Read state with selectors (avoids re-renders from high-frequency player moves)
  const status = useMetaverseStore((s) => s.status);
  const self = useMetaverseStore((s) => s.self);
  const onlineCount = useMetaverseStore(
    (s) => s.players.length + (s.self ? 1 : 0),
  );
  const messages = useMetaverseStore((s) => s.messages);

  // Send actions are stable references
  const sendName = useMetaverseStore((s) => s.sendName);
  const sendChat = useMetaverseStore((s) => s.sendChat);
  const sendVoice = useMetaverseStore((s) => s.sendVoice);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Status bar */}
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-2">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur transition hover:bg-black/70"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Leave
        </button>

        <div className="flex items-center gap-3 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
          <span className="font-medium text-white">{pid}</span>
          <span className="text-white/40">|</span>

          {self && (
            <>
              <NameEditor name={self.name} onSave={sendName} />
              <span className="text-white/40">|</span>
            </>
          )}

          <span
            className={
              status === "connected"
                ? "text-green-400"
                : status === "connecting"
                  ? "text-yellow-400"
                  : "text-red-400"
            }
          >
            {status}
          </span>
          <span className="text-white/40">|</span>
          <span>{onlineCount} online</span>
        </div>

        <div className="w-[80px]"></div>
      </div>

      {/* 3D World */}
      <GameWorld placeId={pid} />

      {/* Center-bottom mic button */}
      <div className="absolute right-4 bottom-30  lg:bottom-17 lg:left-1/2 lg:-translate-x-1/2 z-30">
        <VoiceRecordButton onSendVoice={sendVoice} />
      </div>

      {/* Chat overlay */}
      <ChatWindow
        messages={messages}
        onSend={sendChat}
        onSendVoice={sendVoice}
        selfId={self?.id ?? null}
      />
    </div>
  );
}
