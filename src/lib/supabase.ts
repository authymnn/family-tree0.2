import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { FamilyTreeData, SharedDisplayPreset, ThemeSettings } from '../types/family';
import { EditAccessMode, ViewAccessMode } from '../types/access';

function sanitizeEnvValue(raw: string | undefined, expectedKeyPrefix: string): string {
  if (!raw) return '';
  let val = raw.trim();
  const prefix = `${expectedKeyPrefix}=`;
  if (val.startsWith(prefix)) {
    val = val.slice(prefix.length).trim();
  }
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

const SUPABASE_URL = sanitizeEnvValue(
  import.meta.env.VITE_SUPABASE_URL as string | undefined,
  'VITE_SUPABASE_URL'
);
const SUPABASE_ANON_KEY = sanitizeEnvValue(
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  'VITE_SUPABASE_ANON_KEY'
);

export const FAMILY_TREE_ID =
  sanitizeEnvValue(
    import.meta.env.VITE_FAMILY_TREE_ID as string | undefined,
    'VITE_FAMILY_TREE_ID'
  ) || 'main';

const hasValidUrl = /^https?:\/\/.+/i.test(SUPABASE_URL);
export const isSupabaseConfigured = Boolean(hasValidUrl && SUPABASE_ANON_KEY);

export const supabase: SupabaseClient | null = (() => {
  if (!isSupabaseConfigured) return null;
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch {
    return null;
  }
})();

// Unique per-browser-tab identifier to prevent echoing our own saves
export const CLIENT_INSTANCE_ID = `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

let activeSyncChannel: RealtimeChannel | null = null;

export interface FetchCloudTreeResponse {
  ok: boolean;
  exists?: boolean;
  locked_view?: boolean;
  clan_name?: string;
  tree_data?: FamilyTreeData;
  theme_settings?: SharedDisplayPreset | ThemeSettings | null;
  view_mode: ViewAccessMode;
  edit_mode: EditAccessMode;
  is_admin?: boolean;
  can_edit?: boolean;
  updated_at?: string;
  updated_by?: string;
  error?: string;
}

export async function fetchCloudTreeStatus(): Promise<{
  exists?: boolean;
  updated_at?: string;
  updated_by?: string;
  view_mode?: ViewAccessMode;
  edit_mode?: EditAccessMode;
} | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_family_tree_status', {
    p_tree_id: FAMILY_TREE_ID,
  });
  if (error || !data) return null;
  return data as {
    exists?: boolean;
    updated_at?: string;
    updated_by?: string;
    view_mode?: ViewAccessMode;
    edit_mode?: EditAccessMode;
  };
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
  themeSettings?: SharedDisplayPreset | ThemeSettings;
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
  const result = data as { ok: boolean; updated_at?: string; error?: string };
  if (result.ok) {
    broadcastCloudSync({
      updated_at: result.updated_at,
      updated_by: params.editorName ?? 'family_member',
    });
  }
  return result;
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
  const result = data as { ok: boolean; error?: string };
  if (result.ok) {
    broadcastCloudSync({
      updated_at: new Date().toISOString(),
      updated_by: 'admin_access_change',
    });
  }
  return result;
}

/**
 * Send an ultra-fast (~50ms) Realtime Broadcast ping to all other connected family devices.
 */
export function broadcastCloudSync(payload: {
  updated_at?: string;
  updated_by?: string;
}): void {
  if (!activeSyncChannel) return;
  activeSyncChannel
    .send({
      type: 'broadcast',
      event: 'tree_updated',
      payload: {
        ...payload,
        client_id: CLIENT_INSTANCE_ID,
      },
    })
    .catch(() => {
      // ignore transient send issues; postgres_changes + polling cover fallback
    });
}

/**
 * Subscribe to real-time sync via BOTH:
 * 1) Instant Realtime Broadcast (~50ms latency across all devices)
 * 2) Postgres Changes on `family_tree_sync` (database-level durability)
 */
export function subscribeToCloudSync(
  onSyncPing: (payload: {
    updated_at?: string;
    updated_by?: string;
    client_id?: string;
    source: 'broadcast' | 'postgres';
  }) => void,
  onRealtimeStateChange?: (connected: boolean) => void
): () => void {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`family_tree_live_${FAMILY_TREE_ID}`, {
      config: {
        broadcast: { self: false },
      },
    })
    .on('broadcast', { event: 'tree_updated' }, ({ payload }) => {
      const p = payload as { updated_at?: string; updated_by?: string; client_id?: string } | undefined;
      if (p?.client_id === CLIENT_INSTANCE_ID) return;
      onSyncPing({
        updated_at: p?.updated_at,
        updated_by: p?.updated_by,
        client_id: p?.client_id,
        source: 'broadcast',
      });
    })
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
        onSyncPing({
          updated_at: rec?.updated_at,
          updated_by: rec?.updated_by,
          source: 'postgres',
        });
      }
    )
    .subscribe((status) => {
      onRealtimeStateChange?.(status === 'SUBSCRIBED');
    });

  activeSyncChannel = channel;

  return () => {
    if (activeSyncChannel === channel) {
      activeSyncChannel = null;
    }
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
      return dataUrl;
    }

    const { data: pub } = supabase.storage.from('family-photos').getPublicUrl(filePath);
    return pub?.publicUrl || dataUrl;
  } catch {
    return dataUrl;
  }
}
