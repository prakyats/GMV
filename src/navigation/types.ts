export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type VaultStackParamList = {
  VaultList: undefined;
  VaultDetail: { vaultId: string };
  MemoryDetail: { memoryId: string; vaultId: string };
};

export type BottomTabParamList = {
  Vaults: undefined;
  OnThisDay: undefined;
  Settings: undefined;
};
