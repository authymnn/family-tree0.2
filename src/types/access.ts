export type ViewAccessMode = 'public' | 'pin';

export type EditAccessMode = 'open' | 'pin' | 'locked';

export interface AccessState {
  viewMode: ViewAccessMode;
  editMode: EditAccessMode;
  isAdmin: boolean;
  canEdit: boolean;
  viewLocked: boolean;
  lockedClanName?: string;
}

export interface LocalAccessConfig {
  viewMode: ViewAccessMode;
  viewPin: string;
  editMode: EditAccessMode;
  editPin: string;
  adminPin: string;
}

export type CloudSyncStatus = 'offline' | 'connecting' | 'synced' | 'saving' | 'error';
