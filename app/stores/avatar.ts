import { create } from "zustand";

const STORAGE_KEY_URL = "lambobo-avatar-url";
const STORAGE_KEY_THUMB = "lambobo-avatar-thumb";

interface AvatarStore {
  avatarUrl: string | null;
  avatarThumb: string | null;
  setAvatar: (url: string, thumb: string) => void;
  clear: () => void;
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persist(key: string, value: string | null) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // storage full or unavailable
  }
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  avatarUrl: load(STORAGE_KEY_URL),
  avatarThumb: load(STORAGE_KEY_THUMB),

  setAvatar: (url, thumb) => {
    persist(STORAGE_KEY_URL, url);
    persist(STORAGE_KEY_THUMB, thumb);
    set({ avatarUrl: url, avatarThumb: thumb });
  },

  clear: () => {
    persist(STORAGE_KEY_URL, null);
    persist(STORAGE_KEY_THUMB, null);
    set({ avatarUrl: null, avatarThumb: null });
  },
}));
