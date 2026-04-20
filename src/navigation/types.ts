export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds?: number;
};

export interface VaultMember {
  id: string;
  name: string;
  displayName?: string | null;
  photoURL?: string | null;
}

export interface Memory {
  id: string;
  vaultId?: string;
  type: 'text' | 'image';
  caption: string;
  imageURL: string | null;
  createdBy: { id: string; name: string; displayName?: string | null; photoURL?: string | null; };
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
  VaultDetail: { vaultId: string; vaultName?: string; memoryId?: string };
  VaultMembers: { vaultId: string; vaultName: string; createdBy: string };
};

export type SettingsStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
};

export type ReliveStackParamList = {
  OnThisDayMain: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  MemoryDetail: { memoryId: string; vaultId: string; memory?: Memory };
  MemoryEntry: { vaultId: string; memoryId: string };
};