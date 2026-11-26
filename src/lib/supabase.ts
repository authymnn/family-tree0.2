import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FamilyTreeData, ThemeSettings } from '../types/family';
import { EditAccessMode, ViewAccessMode } from '../types/access';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const FAMILY_TREE_ID =
  (import.meta.env.VITE_FAMILY_TREE_ID as string | undefined)?.trim() || 'main';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export interface FetchCloudTreeResponse {
  ok: boolean;
  exists?: boolean;
  locked_view?: boolean;
  clan_name?: string;
  tree_data?: FamilyTreeData;
  theme_settings?: ThemeSettings | null;
  view_mode: ViewAccessMode;
  edit_mode: EditAccessMode;
  is_admin?: boolean;
  can_edit?: boolean;
  updated_at?: string;
  updated_by?: string;
  error?: string;
}

export async function fetchCloudFamilyTree(params: {
  viewPin?: string;
  editPin?: string;
  adminPin?: string;
}): Promise<FetchCloudTreeResponse> {
  if (!supabase) {
    return { ok: false, view_mode: 'public', edit_mode: 'open', error: 'ยังไม่ได้ตั้งค่า Supabase' };
  }
  const { data, error } = await supabase.rpc('get_family_tree', {
    p_tree_id: FAMILY_TREE_ID,
    p_view_pin: params.viewPin ?? '',
    p_edit_pin: params.editPin ?? '',
    p_admin_pin: params.adminPin ?? '',
  });
  if (error) {
    return {
      ok: false,
      view_mode: 'public',
      edit_mode: 'open',
      error: error.message || 'ไม่สามารถเชื่อมต่อ Supabase ได้',
    };
  }
  return data as FetchCloudTreeResponse;
}

export async function saveCloudFamilyTree(params: {
  treeData: FamilyTreeData;
  themeSettings?: ThemeSettings;
  editPin?: string;
  adminPin?: string;
  editorName?: string;
}): Promise<{ ok: boolean; updated_at?: string; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase' };
  }
  const { data, error } = await supabase.rpc('save_family_tree', {
    p_tree_id: FAMILY_TREE_ID,
    p_tree_data: params.treeData,
    p_theme_settings: params.themeSettings ?? null,
    p_edit_pin: params.editPin ?? '',
    p_admin_pin: params.adminPin ?? '',
    p_editor_name: params.editorName ?? 'family_member',
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return data as { ok: boolean; updated_at?: string; error?: string };
}

export async function updateCloudAccessSettings(params: {
  adminPin: string;
  viewMode: ViewAccessMode;
  editMode: EditAccessMode;
  newViewPin?: string;
  newEditPin?: string;
  newAdminPin?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) {
    return { ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase' };
  }
  const { data, error } = await supabase.rpc('update_tree_access_settings', {
    p_tree_id: FAMILY_TREE_ID,
    p_admin_pin: params.adminPin,
    p_view_mode: params.viewMode,
    p_edit_mode: params.editMode,
    p_new_view_pin: params.newViewPin || null,
    p_new_edit_pin: params.newEditPin || null,
    p_new_admin_pin: params.newAdminPin || null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return data as { ok: boolean; error?: string };
}

/**
 * Subscribe to real-time sync pings whenever another family member saves or admin changes lock state.
 */
export function subscribeToCloudSync(
  onSyncPing: (payload: { updated_at?: string; updated_by?: string }) => void
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`family_tree_sync_${FAMILY_TREE_ID}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'family_tree_sync',
        filter: `tree_id=eq.${FAMILY_TREE_ID}`,
      },
      (payload) => {
        const rec = payload.new as { updated_at?: string; updated_by?: string } | undefined;
        onSyncPing({ updated_at: rec?.updated_at, updated_by: rec?.updated_by });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Upload a compressed JPEG Data URL to Supabase Storage bucket `family-photos` if connected.
 * Gracefully falls back to returning the compressed Data URL directly if offline or bucket unavailable.
 */
export async function uploadDataUrlToStorage(
  dataUrl: string,
  folder: 'avatars' | 'gallery' | 'backgrounds' = 'avatars'
): Promise<string> {
  if (!supabase || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const filePath = `${FAMILY_TREE_ID}/${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error } = await supabase.storage
      .from('family-photos')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      });

    if (error) {
      // Fallback to inline compressed Data URL if storage bucket isn't created yet
      return dataUrl;
    }

    const { data: pub } = supabase.storage.from('family-photos').getPublicUrl(filePath);
    return pub?.publicUrl || dataUrl;
  } catch {
    return dataUrl;
  }
}
