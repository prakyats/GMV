import { create } from 'zustand';

interface VaultState {
  currentVaultId: string | null;
  currentVaultMembers: string[];
  vaults: any[]; // The global list of vaults for the user
  setCurrentVault: (vaultId: string, members: string[]) => void;
  setVaults: (vaults: any[], currentUserId: string | null) => void;
  removeVault: (vaultId: string) => void;
  clearVault: () => void;
}

/**
 * Store for managing the state of vaults.
 * SSoT (Single Source of Truth) for the vault list and active vault context.
 */
export const useVaultStore = create<VaultState>((set) => ({
  currentVaultId: null,
  currentVaultMembers: [],
  vaults: [],
  
  setCurrentVault: (vaultId, members) => set({ 
    currentVaultId: vaultId, 
    currentVaultMembers: members 
  }),

  setVaults: (incomingVaults, currentUserId) => {
    // Fail-Closed: If no user, result is empty
    if (!currentUserId) {
      return set({ vaults: [] });
    }

    // Strict Filter: Only keep vaults where the user is an active member
    const filtered = incomingVaults.filter(v => 
      v && 
      Array.isArray(v.members) && 
      v.members.includes(currentUserId)
    );

    set({ vaults: filtered });
  },

  removeVault: (vaultId) => set((state) => {
    // Only update if the vault actually exists to avoid redundant renders
    if (!state.vaults.some(v => v.id === vaultId)) return state;
    
    return {
      vaults: state.vaults.filter(v => v.id !== vaultId)
    };
  }),
  
  clearVault: () => set({ 
    currentVaultId: null, 
    currentVaultMembers: [],
    vaults: [] 
  }),
}));
