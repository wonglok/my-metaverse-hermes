import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useMetaverseStore } from "@/stores/metaverse";
import { useAvatarStore } from "@/stores/avatar";
import { GameWorld } from "@/components/metaverse/world";
import { ChatWindow } from "@/components/chat/chat-window";
import { VoiceRecordButton } from "@/components/chat/voice-record-button";
import { VRMPicker } from "@/components/metaverse/VRMAvatar";
import { GameHUD } from "@/components/game/hud";

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
      {/* ── HUD: info pill + menu ─────────────────────────────── */}
      <GameHUD
        placeId={pid}
        status={status}
        onlineCount={onlineCount}
        playerName={self?.name ?? ""}
        avatarThumb={avatarThumb}
        onSaveName={sendName}
        onOpenAvatar={() => setShowPicker(true)}
        onToggleChat={() => {
          // Click the chat toggle button in the DOM
          document
            .querySelector<HTMLButtonElement>("[data-chat-toggle]")
            ?.click();
        }}
        onLeave={() => navigate("/")}
      />

      {/* ── Avatar picker overlay ─────────────────────────────── */}
      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute right-4 top-14 z-50">
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

      {/* ── 3D World ──────────────────────────────────────────── */}
      <GameWorld placeId={pid} avatarUrl={avatarUrl} />

      {/* ── Center-bottom mic button ──────────────────────────── */}
      <div className="absolute left-1/2 bottom-5 lg:bottom-17 -translate-x-1/2 z-30">
        <VoiceRecordButton onSendVoice={sendVoice} />
      </div>

      {/* ── Chat overlay ──────────────────────────────────────── */}
      <ChatWindow
        messages={messages}
        onSend={sendChat}
        onSendVoice={sendVoice}
        selfId={self?.id ?? null}
      />
    </div>
  );
}
