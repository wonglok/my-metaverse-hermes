import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useMetaverseStore } from "@/stores/metaverse";
import { useAvatarStore } from "@/stores/avatar";
import { GameWorld } from "@/components/metaverse/world";
import { ChatWindow } from "@/components/chat/chat-window";
import { VoiceRecordButton } from "@/components/chat/voice-record-button";
import { VRMPicker } from "@/components/metaverse/VRMAvatar";

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
      <>
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
          className="w-[155px] rounded bg-black/40 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-white/30 text-[17px]"
        />
        <></>
      </>
    );
  }

  return (
    <>
      <div className="flex">
        <button
          onClick={() => setEditing(true)}
          className="cursor-pointer rounded px-1 -mx-1 text-xs text-white/80 hover:bg-white/10 hover:text-white transition"
          title="Click to change name"
        >
          {name}
        </button>
        <svg
          onClick={() => setEditing(true)}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-white/50"
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </div>
    </>
  );
}

export function GamePage() {
  const { placeId } = useParams<{ placeId: string }>();
  const navigate = useNavigate();
  const pid = placeId ?? "default";

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
  const sendAvatar = useMetaverseStore((s) => s.sendAvatar);

  const avatarUrl = useAvatarStore((s) => s.avatarUrl);
  const avatarThumb = useAvatarStore((s) => s.avatarThumb);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  const [showPicker, setShowPicker] = useState(false);

  // Connect the WebSocket for this place
  useEffect(() => {
    const storedUrl = localStorage.getItem("lambobo-avatar-url");
    return useMetaverseStore.getState().connect(pid, storedUrl);
  }, [pid]);

  // Send avatar update when it changes
  useEffect(() => {
    if (avatarUrl) {
      sendAvatar(avatarUrl);
    }
  }, [avatarUrl]);

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

        <div className="flex items-center gap-3">
          <div className="block lg:flex items-center gap-3 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
            <span className="font-medium text-white">{pid}</span>
            <span className="text-white/40 inline-block">|</span>

            {self && (
              <>
                <NameEditor name={self.name} onSave={sendName} />
                <span className="text-white/40 inline-block">|</span>
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
            <span className="text-white/40 inline-block">|</span>
            <span>{onlineCount} online</span>
          </div>

          {/* Avatar picker button */}
          <button
            onClick={() => setShowPicker((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/80 backdrop-blur transition hover:bg-white/10 ${
              showPicker ? "bg-white/15" : "bg-black/50"
            }`}
            title="Change avatar"
          >
            {avatarThumb ? (
              <img
                src={avatarThumb}
                alt="Avatar"
                className="size-6 rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
              </svg>
            )}
            <span className="hidden sm:inline">Avatar</span>
          </button>
        </div>
      </div>

      {/* Avatar picker overlay */}
      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute right-4 top-12 z-50">
            <VRMPicker
              selectedId={avatarUrl ?? undefined}
              onSelect={(item: any) => {
                const url = `https://d2upc1jytt7esc.cloudfront.net/vrm-avatars/${item.project_id}/${item.name}/model.vrm`;
                const thumb = `https://d2upc1jytt7esc.cloudfront.net/vrm-avatars/${item.project_id}/${item.name}/thumbnail.gif`;
                setAvatar(url, thumb);
                setShowPicker(false);
              }}
              onClose={() => setShowPicker(false)}
            />
          </div>
        </>
      )}

      {/* 3D World */}
      <GameWorld placeId={pid} avatarUrl={avatarUrl} />

      {/* Center-bottom mic button */}
      <div className="absolute left-[50%] bottom-5 lg:bottom-17 lg:left-1/2 -translate-x-1/2 z-30">
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
