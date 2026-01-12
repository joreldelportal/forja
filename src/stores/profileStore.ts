import { create } from "zustand";
import type { Profile } from "../services/profileService";
import { getMyProfile } from "../services/profileService";

type ProfileState = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;

  loadMyProfile: (userId: string) => Promise<void>;
  clear: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  error: null,

  loadMyProfile: async (userId) => {
    set({ loading: true, error: null });
    const { data, error } = await getMyProfile(userId);

    if (error) {
      set({ loading: false, error });
      return;
    }

    set({ loading: false, profile: data ?? null });
  },

  clear: () => set({ profile: null, loading: false, error: null }),
}));
