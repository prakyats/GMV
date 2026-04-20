export const NAV_ROUTES = {
  TABS: "Tabs",
  VAULTS_TAB: "Vaults",
  VAULT_DETAIL: "VaultDetail",
  MEMORY_DETAIL: "MemoryDetail",
  MEMORY_ENTRY: "MemoryEntry",
} as const;

export type NavRouteType = typeof NAV_ROUTES[keyof typeof NAV_ROUTES];