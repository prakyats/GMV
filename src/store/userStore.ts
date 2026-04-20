import { create } from 'zustand';
import { AppUser } from './authStore';

interface UserState {
  /** Map of UID to real-time profile data */
  usersMap: Record<string, AppUser>;
  
  /** 
   * Incremental update for a single user.
   * Preserves existing map and updates only the targeted UID.
   */
  upsertUser: (uid: string, profile: AppUser) => void;
  
  /** Remove a user from the cache */
  removeUser: (uid: string) => void;
  
  /** Reset the entire cache (on logout) */
  clearUsers: () => void;
}

/**
 * Global User Store
 * Holds real-time peer profile data fetched via targeted listeners.
 * Separate from authStore (which holds the current authenticated user).
 */
export const useUserStore = create<UserState>((set) => ({
  usersMap: {},
  
  upsertUser: (uid, profile) => set((state) => ({
    usersMap: {
      ...state.usersMap,
      [uid]: profile
    }
  })),
  
  removeUser: (uid) => set((state) => {
    const newMap = { ...state.usersMap };
    delete newMap[uid];
    return { usersMap: newMap };
  }),
  
  clearUsers: () => set({ usersMap: {} }),
}));
