import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

// ── Status dot ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  return (
    <span className="relative flex size-2">
      {status === "connected" && (
        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          status === "connected"
            ? "bg-emerald-400"
            : status === "connecting"
              ? "bg-amber-400"
              : "bg-red-400",
        )}
      />
    </span>
  );
}

// ── HUD Info Pill ────────────────────────────────────────────────────────

function HUDInfo({
  placeId,
  status,
  onlineCount,
}: {
  placeId: string;
  status: string;
  onlineCount: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl px-3.5 py-2",
        "bg-black/30 backdrop-blur-2xl",
        "border border-white/[0.08]",
        "shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]",
        "transition-colors duration-500",
      )}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-white/50"
      >
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
      <span className="text-sm font-medium text-white/90 tracking-tight">
        {placeId}
      </span>

      <span className="h-3.5 w-px bg-white/[0.12]" />

      <StatusDot status={status} />
      <span className="text-sm text-white/60 tabular-nums">
        {onlineCount}
        <span className="hidden sm:inline"> online</span>
      </span>
    </div>
  );
}

// ── Name edit dialog (popup) ─────────────────────────────────────────────

function NameEditDialog({
  name,
  open,
  onSave,
  onClose,
}: {
  name: string;
  open: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(name);
      // Focus after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, name]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      e.stopPropagation();

      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) onSave(trimmed);
    onClose();
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    commit();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "relative w-full max-w-xs rounded-2xl p-6",
          "bg-black/70 backdrop-blur-2xl",
          "border border-white/[0.1]",
          "shadow-[0_16px_48px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
      >
        <h3 className="text-sm font-semibold text-white/90 mb-4">
          Change Name
        </h3>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 24))}
          maxLength={24}
          className={cn(
            "w-full rounded-xl px-3.5 py-2.5 text-sm",
            "bg-white/[0.06] border border-white/[0.1]",
            "text-white placeholder:text-white/20",
            "outline-none",
            "focus:border-white/25 focus:ring-1 focus:ring-white/10",
            "transition",
          )}
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium",
              "text-white/50 hover:text-white/80 hover:bg-white/[0.06]",
              "transition cursor-pointer",
            )}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim() || value.trim() === name}
            className={cn(
              "rounded-xl bg-primary px-4 py-2 text-sm font-semibold",
              "text-primary-foreground transition-all",
              "hover:opacity-90",
              "disabled:opacity-25 disabled:cursor-not-allowed",
              "cursor-pointer",
            )}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Menu panel ───────────────────────────────────────────────────────────

interface MenuPanelProps {
  playerName: string;
  avatarThumb: string | null;
  onOpenNameEditor: () => void;
  onOpenAvatar: () => void;
  onToggleChat: () => void;
  onLeave: () => void;
  onClose: () => void;
}

function MenuPanel({
  playerName,
  avatarThumb,
  onOpenNameEditor,
  onOpenAvatar,
  onToggleChat,
  onLeave,
  onClose,
}: MenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Focus panel on mount
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="menu"
      className={cn(
        "flex flex-col gap-1 w-[240px] rounded-2xl p-2",
        "bg-black/40 backdrop-blur-2xl",
        "border border-white/[0.08]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]",
        "outline-none",
      )}
    >
      {/* Player identity */}
      <div className="flex items-center gap-3 px-2.5 py-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] ring-1 ring-white/[0.1] overflow-hidden">
          {avatarThumb ? (
            <img src={avatarThumb} alt="" className="size-full object-cover" />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white/40"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {playerName ? (
            <button
              onClick={onOpenNameEditor}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 -mx-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition cursor-pointer"
            >
              <span className="truncate">{playerName}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0 text-white/30"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          ) : (
            <span className="block px-2.5 py-1.5 text-sm text-white/40">
              Joining...
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/[0.08] mx-2" />

      {/* Actions */}
      <button
        onClick={() => {
          onOpenAvatar();
          onClose();
        }}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white transition cursor-pointer text-left w-full"
        role="menuitem"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-white/40"
        >
          <rect x="2" y="2" width="20" height="20" rx="4" />
          <circle cx="8.5" cy="10" r="2.5" />
          <path d="M2 18c0-2.5 3-4.5 6.5-4.5 1.2 0 2.3.3 3.3.8" />
          <path d="M14 8l4 4-4 4" />
        </svg>
        Change Avatar
      </button>

      <button
        onClick={() => {
          onToggleChat();
          onClose();
        }}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] hover:text-white transition cursor-pointer text-left w-full"
        role="menuitem"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-white/40"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Chat
      </button>

      <div className="h-px bg-white/[0.08] mx-2" />

      <button
        onClick={onLeave}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-300/80 hover:bg-rose-400/[0.08] hover:text-rose-200 transition cursor-pointer text-left w-full"
        role="menuitem"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Leave Place
      </button>
    </div>
  );
}

// ── Menu button + dropdown ───────────────────────────────────────────────

function HUDMenu({
  playerName,
  avatarThumb,
  onSaveName,
  onOpenAvatar,
  onToggleChat,
  onLeave,
}: {
  playerName: string;
  avatarThumb: string | null;
  onSaveName: (name: string) => void;
  onOpenAvatar: () => void;
  onToggleChat: () => void;
  onLeave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-10 items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer",
          "bg-black/30 backdrop-blur-2xl",
          "border border-white/[0.08]",
          "shadow-[0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]",
          open
            ? "bg-white/[0.12] border-white/[0.14]"
            : "hover:bg-white/[0.08] hover:border-white/[0.12]",
        )}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-white/70"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-white/70"
          >
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 animate-in fade-in zoom-in-95 duration-200">
          <MenuPanel
            playerName={playerName}
            avatarThumb={avatarThumb}
            onOpenNameEditor={() => setNameDialogOpen(true)}
            onOpenAvatar={onOpenAvatar}
            onToggleChat={onToggleChat}
            onLeave={onLeave}
            onClose={close}
          />
        </div>
      )}

      {/* Name edit dialog — rendered outside the menu so it is independent */}
      <NameEditDialog
        name={playerName}
        open={nameDialogOpen}
        onSave={(newName) => {
          onSaveName(newName);
          close();
        }}
        onClose={() => setNameDialogOpen(false)}
      />
    </div>
  );
}

// ── Main HUD export ──────────────────────────────────────────────────────

interface GameHUDProps {
  placeId: string;
  status: string;
  onlineCount: number;
  playerName: string;
  avatarThumb: string | null;
  onSaveName: (name: string) => void;
  onOpenAvatar: () => void;
  onToggleChat: () => void;
  onLeave: () => void;
}

export function GameHUD({
  placeId,
  status,
  onlineCount,
  playerName,
  avatarThumb,
  onSaveName,
  onOpenAvatar,
  onToggleChat,
  onLeave,
}: GameHUDProps) {
  return (
    <div className="absolute left-0 right-0 top-0 z-30 flex items-start justify-between p-3 sm:p-4">
      <HUDInfo placeId={placeId} status={status} onlineCount={onlineCount} />
      <HUDMenu
        playerName={playerName}
        avatarThumb={avatarThumb}
        onSaveName={onSaveName}
        onOpenAvatar={onOpenAvatar}
        onToggleChat={onToggleChat}
        onLeave={onLeave}
      />
    </div>
  );
}
