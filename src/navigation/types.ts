export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds?: number;
};

export interface Memory {
  id: string;
  vaultId?: string;
  type: 'text' | 'image';
  caption: string;
  imageURL: string | null;
  createdBy: { id: string; name: string };
  createdAt: FirestoreTimestamp | null;
  memoryDate: FirestoreTimestamp | null;
  reactions: Record<string, string> | null;
  viewedBy: string[] | null;
  contributorCount?: number;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  MemoryPreview: { vaultId: string; memoryId: string };
  MemoryEntry: { vaultId: string; memoryId: string };
};

export type BottomTabParamList = {
  Vaults: undefined;
  OnThisDay: undefined;
  Settings: undefined;
};

export type VaultStackParamList = {
  VaultList: undefined;
  VaultDetail: { vaultId: string; vaultName: string };
};

export type MainStackParamList = {
  Tabs: undefined;
  MemoryDetail: { memoryId: string; vaultId: string };
  MemoryEntry: { vaultId: string; memoryId: string };
};