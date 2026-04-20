import { createNavigationContainerRef } from '@react-navigation/native';
import { NAV_ROUTES } from './routes';

export const navigationRef = createNavigationContainerRef<any>();

let pendingVaultDetail: { vaultId: string; memoryId?: string } | null = null;

/**
 * Specialized helper to navigate to VaultDetail through the correct nesting.
 * Hierarchy: Tabs -> Vaults (Tab) -> VaultDetail (Screen)
 */
export const navigateToVaultDetail = (vaultId: string, memoryId?: string) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(NAV_ROUTES.TABS, {
      screen: NAV_ROUTES.VAULTS_TAB,
      params: {
        screen: NAV_ROUTES.VAULT_DETAIL,
        params: {
          vaultId,
          memoryId: memoryId || null,
        },
      },
    });
  } else {
    pendingVaultDetail = { vaultId, memoryId };
  }
};

/**
 * Legacy/General navigate helper for non-nested or simple routes.
 */
export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

/**
 * Get pending navigation.
 */
export function getPendingNavigation() {
  return pendingVaultDetail;
}

/**
 * Clear pending navigation.
 */
export function clearPendingNavigation() {
  pendingVaultDetail = null;
}

/**
 * Flush any pending navigation that occurred before the navigator was ready.
 * Should be called in the NavigationContainer's onReady callback.
 */
export function flushNavigation() {
  if (pendingVaultDetail && navigationRef.isReady()) {
    navigateToVaultDetail(pendingVaultDetail.vaultId, pendingVaultDetail.memoryId);
    pendingVaultDetail = null;
  }
}
