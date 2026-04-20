import { create } from 'zustand';

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  isDeletingAccount: boolean;
  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
  setIsDeletingAccount: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isDeletingAccount: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setIsDeletingAccount: (val) => set({ isDeletingAccount: val }),
}));
