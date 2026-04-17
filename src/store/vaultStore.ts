import { create } from 'zustand';

interface VaultState {
  currentVaultId: string | null;
  currentVaultMembers: string[];
  setCurrentVault: (vaultId: string, members: string[]) => void;
  clearVault: () => void;
}

/**
 * Store for managing the state of the currently selected vault.
 * Used for navigation and data scoping across screens.
 */
export const useVaultStore = create<VaultState>((set) => ({
  currentVaultId: null,
  currentVaultMembers: [],
  
  setCurrentVault: (vaultId, members) => set({ 
    currentVaultId: vaultId, 
    currentVaultMembers: members 
  }),
  
  clearVault: () => set({ 
    currentVaultId: null, 
    currentVaultMembers: [] 
  }),
}));
