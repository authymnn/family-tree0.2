import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TreePine,
  Users,
  GitCompare,
  BarChart3,
  Search,
  Settings,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  X,
  Palette,
  BookOpenCheck,
  Shield,
  ShieldCheck,
  Lock,
  Cloud,
  Download,
  Eye,
} from 'lucide-react';
import {
  CardStyle,
  FamilyTreeData,
  Person,
  QuickAddRelation,
  SharedDisplayPreset,
  SpouseStatus,
  ThemeSettings,
  TreeOrientation,
  ViewMode,
} from './types/family';
import {
  AccessState,
  CloudSyncStatus,
  EditAccessMode,
  LocalAccessConfig,
  ViewAccessMode,
} from './types/access';
import { createEmptyFamilyTree, createSampleFamilyTree } from './data/sampleFamily';
import {
  addRelative,
  createBlankPerson,
  deletePerson,
  getDisplayNameWithNickname,
  linkParentChild,
  linkSpouses,
  reorderChildren,
  unlinkParentChild,
  unlinkSpouses,
  updateSpouseDetails,
  updateSpouseStatus,
  upsertPerson,
  validateImportedData,
} from './utils/familyOps';
import { mergeFamilyTreeData } from './utils/familyMerge';
import { computeFamilyTreeLayout } from './utils/treeLayout';
import { getLineageHighlightSet } from './utils/kinship';
import { exportTreeAsPng } from './utils/exportImage';
import {
  applyThemeToDocument,
  loadSavedTheme,
  resolveTheme,
  saveThemeSettings,
} from './utils/themes';
import {
  fetchCloudFamilyTree,
  fetchCloudTreeHistory,
  fetchCloudTreeStatus,
  isSupabaseConfigured,
  restoreCloudTreeVersion,
  saveCloudFamilyTree,
  subscribeToCloudSync,
  updateCloudAccessSettings,
} from './lib/supabase';
import { TreeCanvas, TreeCanvasHandle } from './components/TreeCanvas';
import { PersonDrawer } from './components/PersonDrawer';
import { PersonPreviewModal } from './components/PersonPreviewModal';
import { ExportShareModal } from './components/ExportShareModal';
import { QuickAddModal } from './components/QuickAddModal';
import { DirectoryView } from './components/DirectoryView';
import { KinshipView } from './components/KinshipView';
import { OverviewView } from './components/OverviewView';
import { ClanSettingsModal } from './components/ClanSettingsModal';
import { ThemePickerModal } from './components/ThemePickerModal';
import { SimpleView } from './components/SimpleView';
import { AdminAccessModal } from './components/AdminAccessModal';
import { AccessGateScreen } from './components/AccessGateScreen';
import { CoupleDetailModal } from './components/CoupleDetailModal';
import { PersonAvatar } from './components/PersonAvatar';
import { ActivityNotification, NotificationCenter } from './components/NotificationCenter';

const STORAGE_KEY = 'thai_family_tree_v1';
const LOCAL_SAFETY_BACKUP_KEY = 'thai_family_tree_safety_backup_v1';
const LOCAL_ACCESS_KEY = 'thai_family_tree_local_access_v1';
const SESSION_PINS_KEY = 'thai_family_tree_session_pins_v1';
const VIEW_PREFS_KEY = 'thai_family_tree_view_prefs_v1';
const APPLIED_PRESET_KEY = 'thai_family_tree_applied_preset_at_v1';
const NOTIFICATIONS_KEY = 'thai_family_tree_notifications_v1';
const NOTIFICATIONS_READ_KEY = 'thai_family_tree_notifications_read_at_v1';

function loadNotifications(): ActivityNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 40);
    }
  } catch {
    // ignore
  }
  return [];
}

function loadNotificationsReadAt(): string {
  try {
    return localStorage.getItem(NOTIFICATIONS_READ_KEY) || '';
  } catch {
    return '';
  }
}

function loadViewPrefs(): { cardStyle: CardStyle; orientation: TreeOrientation } {
  try {
    const raw = localStorage.getItem(VIEW_PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<{ cardStyle: CardStyle; orientation: TreeOrientation }>;
      const validStyle: CardStyle =
        p.cardStyle === 'compact' || p.cardStyle === 'photo-only' ? p.cardStyle : 'detailed';
      const validOrientation: TreeOrientation =
        p.orientation === 'bottom-up' || p.orientation === 'left-right'
          ? p.orientation
          : 'top-down';
      return { cardStyle: validStyle, orientation: validOrientation };
    }
  } catch {
    // ignore
  }
  return { cardStyle: 'detailed', orientation: 'top-down' };
}

const DEFAULT_LOCAL_ACCESS: LocalAccessConfig = {
  viewMode: 'public',
  viewPin: '0000',
  editMode: 'open',
  editPin: '8888',
  adminPin: '1234',
};

function loadInitialData(): FamilyTreeData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const valid = validateImportedData(parsed);
      if (valid) return valid;
    }
  } catch {
    // ignore storage read issues
  }
  return createSampleFamilyTree();
}

function loadLocalAccessConfig(): LocalAccessConfig {
  try {
    const raw = localStorage.getItem(LOCAL_ACCESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalAccessConfig>;
      return {
        viewMode: parsed.viewMode === 'pin' ? 'pin' : 'public',
        viewPin: parsed.viewPin || '0000',
        editMode:
          parsed.editMode === 'pin' || parsed.editMode === 'locked' ? parsed.editMode : 'open',
        editPin: parsed.editPin || '8888',
        adminPin: parsed.adminPin || '1234',
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_LOCAL_ACCESS;
}

function loadSessionPins(): { viewPin: string; editPin: string; adminPin: string } {
  try {
    const raw = sessionStorage.getItem(SESSION_PINS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        viewPin: p.viewPin || '',
        editPin: p.editPin || '',
        adminPin: p.adminPin || '',
      };
    }
  } catch {
    // ignore
  }
  return { viewPin: '', editPin: '', adminPin: '' };
}

function computeLocalAccessState(
  cfg: LocalAccessConfig,
  pins: { viewPin: string; editPin: string; adminPin: string },
  clanName: string
): AccessState {
  const isAdmin = Boolean(pins.adminPin && pins.adminPin === cfg.adminPin);
  const viewLocked = cfg.viewMode === 'pin' && !isAdmin && pins.viewPin !== cfg.viewPin;
  const canEdit =
    isAdmin ||
    cfg.editMode === 'open' ||
    (cfg.editMode === 'pin' && pins.editPin === cfg.editPin);
  return {
    viewMode: cfg.viewMode,
    editMode: cfg.editMode,
    isAdmin,
    canEdit,
    viewLocked,
    lockedClanName: clanName,
  };
}

export const App: React.FC = () => {
  const [data, setData] = useState<FamilyTreeData>(loadInitialData);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [notifications, setNotifications] = useState<ActivityNotification[]>(loadNotifications);
  const [lastReadAt, setLastReadAt] = useState<string>(loadNotificationsReadAt);

  // Theme & Canvas Background state
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(loadSavedTheme);
  const palette = useMemo(() => resolveTheme(themeSettings), [themeSettings]);

  // Access Control & Supabase Cloud Sync state
  const [sessionPins, setSessionPins] = useState(loadSessionPins);
  const [localAccessCfg, setLocalAccessCfg] = useState<LocalAccessConfig>(loadLocalAccessConfig);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>(
    isSupabaseConfigured ? 'connecting' : 'offline'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);
  const [gateError, setGateError] = useState('');
  const [gateLoading, setGateLoading] = useState(false);

  const [access, setAccess] = useState<AccessState>(() =>
    isSupabaseConfigured
      ? { viewMode: 'public', editMode: 'open', isAdmin: false, canEdit: false, viewLocked: false }
      : computeLocalAccessState(loadLocalAccessConfig(), loadSessionPins(), loadInitialData().clanName)
  );

  // Refs to prevent save loops and enable conflict-free 3-way multi-user merging
  const dataRef = useRef<FamilyTreeData>(data);
  dataRef.current = data;
  const lastSyncedBaseDataRef = useRef<FamilyTreeData | null>(null);
  const hasUnsavedLocalChangesRef = useRef(false);
  const forceOverwriteCloudRef = useRef(false);
  const suppressNextCloudSaveRef = useRef(false);
  const lastSavedStampRef = useRef<number>(0);
  const lastKnownRemoteStampRef = useRef<number>(0);
  const lastKnownRemoteIsoRef = useRef<string | null>(null);
  const pendingActivityRef = useRef<string>('อัปเดตข้อมูลผังตระกูล');
  const cloudInitializedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const [view, setView] = useState<ViewMode>('tree');
  const [simpleMode, setSimpleMode] = useState(false);
  const [previewPersonId, setPreviewPersonId] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [cardStyle, setCardStyle] = useState<CardStyle>(() => loadViewPrefs().cardStyle);
  const [orientation, setOrientation] = useState<TreeOrientation>(() => loadViewPrefs().orientation);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [focusRootId, setFocusRootId] = useState<string | null>(null);

  const openPersonPreview = useCallback((id: string | null) => {
    setEditingPersonId(null);
    setPreviewPersonId(id);
  }, []);

  const openPersonEditor = useCallback((id: string) => {
    setPreviewPersonId(null);
    setEditingPersonId(id);
  }, []);

  // Save cardStyle & orientation strictly per-device (never synced across family devices)
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify({ cardStyle, orientation }));
    } catch {
      // ignore
    }
  }, [cardStyle, orientation]);

  const [lineageAnchorId, setLineageAnchorId] = useState<string | null>(null);
  const [customHighlight, setCustomHighlight] = useState<{
    ids: Set<string>;
    label: string;
  } | null>(null);

  // Modals
  const [quickAddState, setQuickAddState] = useState<{
    anchorId: string | null;
    relation: QuickAddRelation | 'standalone';
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [coupleModalState, setCoupleModalState] = useState<{
    personAId: string;
    personBId: string;
  } | null>(null);

  // Global search bar
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const treeCanvasRef = useRef<TreeCanvasHandle>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  // Apply CSS custom properties whenever theme changes
  useEffect(() => {
    applyThemeToDocument(palette);
    saveThemeSettings(themeSettings);
  }, [palette, themeSettings]);

  // Persist session PINs
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_PINS_KEY, JSON.stringify(sessionPins));
    } catch {
      // ignore
    }
  }, [sessionPins]);

  // Persist local access config (for offline / local testing)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      try {
        localStorage.setItem(LOCAL_ACCESS_KEY, JSON.stringify(localAccessCfg));
      } catch {
        // ignore
      }
      setAccess(computeLocalAccessState(localAccessCfg, sessionPins, data.clanName));
    }
  }, [localAccessCfg, sessionPins, data.clanName]);

  // Auto-save family tree to localStorage backup + preserve largest safety snapshot
  useEffect(() => {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, serialized);
      const currCount = Object.keys(data.members).length;
      if (currCount > 0) {
        const existingRaw = localStorage.getItem(LOCAL_SAFETY_BACKUP_KEY);
        let prevCount = 0;
        if (existingRaw) {
          try {
            const parsed = JSON.parse(existingRaw) as Partial<FamilyTreeData>;
            prevCount = parsed.members ? Object.keys(parsed.members).length : 0;
          } catch {
            prevCount = 0;
          }
        }
        if (currCount >= prevCount) {
          localStorage.setItem(LOCAL_SAFETY_BACKUP_KEY, serialized);
        }
      }
    } catch {
      showToast('พื้นที่จัดเก็บในเบราว์เซอร์เต็ม แนะนำให้สำรองไฟล์ JSON', 'error');
    }
  }, [data, showToast]);

  // Apply Admin's Broadcast Display Preset ONLY when pushedAt is newer than last applied on this device
  const maybeApplySharedDisplayPreset = useCallback((rawPreset: unknown): boolean => {
    if (!rawPreset || typeof rawPreset !== 'object') return false;
    const preset = rawPreset as Partial<SharedDisplayPreset>;
    if (!preset.pushedAt || !preset.themeSettings) return false;

    const lastApplied = localStorage.getItem(APPLIED_PRESET_KEY) || '';
    if (lastApplied && preset.pushedAt <= lastApplied) {
      return false;
    }

    setThemeSettings((prev) => ({ ...prev, ...preset.themeSettings }));
    if (preset.cardStyle) setCardStyle(preset.cardStyle);
    if (preset.orientation) setOrientation(preset.orientation);
    try {
      localStorage.setItem(APPLIED_PRESET_KEY, preset.pushedAt);
    } catch {
      // ignore
    }
    return true;
  }, []);

  // Pull latest tree + access permissions from Supabase Cloud
  const pullFromCloud = useCallback(
    async (
      pinsOverride?: { viewPin: string; editPin: string; adminPin: string },
      silent = false
    ) => {
      if (!isSupabaseConfigured) return null;
      const activePins = pinsOverride ?? sessionPins;
      const res = await fetchCloudFamilyTree(activePins);

      if (!res.ok) {
        if (res.locked_view) {
          setAccess({
            viewMode: res.view_mode,
            editMode: res.edit_mode,
            isAdmin: false,
            canEdit: false,
            viewLocked: true,
            lockedClanName: res.clan_name,
          });
          setCloudStatus('synced');
          return res;
        }
        setCloudStatus('error');
        if (!silent && res.error) showToast(res.error, 'error');
        return res;
      }

      setCloudStatus('synced');
      if (res.updated_at) {
        setLastSyncedAt(res.updated_at);
        lastKnownRemoteIsoRef.current = res.updated_at;
        const ts = Date.parse(res.updated_at);
        if (!Number.isNaN(ts)) {
          lastKnownRemoteStampRef.current = Math.max(lastKnownRemoteStampRef.current, ts);
        }
      }

      setAccess({
        viewMode: res.view_mode,
        editMode: res.edit_mode,
        isAdmin: Boolean(res.is_admin),
        canEdit: Boolean(res.can_edit),
        viewLocked: false,
      });

      if (res.exists && res.tree_data) {
        const valid = validateImportedData(res.tree_data);
        if (valid) {
          if (hasUnsavedLocalChangesRef.current) {
            // Merge incoming remote changes with unsaved local edits so neither side is lost
            const { merged } = mergeFamilyTreeData(
              lastSyncedBaseDataRef.current,
              dataRef.current,
              valid
            );
            lastSyncedBaseDataRef.current = valid;
            setData(merged);
          } else {
            lastSyncedBaseDataRef.current = valid;
            suppressNextCloudSaveRef.current = true;
            setData(valid);
          }
        }
        // Only apply theme/layout if Admin explicitly pushed a newer SharedDisplayPreset
        if (res.theme_settings) {
          maybeApplySharedDisplayPreset(res.theme_settings);
        }
      }

      cloudInitializedRef.current = true;
      return res;
    },
    [sessionPins, showToast, maybeApplySharedDisplayPreset]
  );

  const pushNotification = useCallback(
    (message: string, opts?: { timestamp?: string; isRemote?: boolean; personId?: string }) => {
      const clean = message.trim();
      if (!clean) return;
      const kind: ActivityNotification['kind'] = clean.includes('เพิ่มสมาชิก')
        ? 'add'
        : clean.includes('แอดมิน') || clean.includes('สิทธิ์') || clean.includes('รูปแบบ')
          ? 'system'
          : 'edit';
      const entry: ActivityNotification = {
        id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        message: clean,
        timestamp: opts?.timestamp || new Date().toISOString(),
        personId: opts?.personId,
        kind,
        isRemote: opts?.isRemote ?? false,
      };
      setNotifications((prev) => {
        const next = [entry, ...prev].slice(0, 40);
        try {
          localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    []
  );

  const handleMarkAllNotificationsRead = useCallback(() => {
    const nowIso = new Date().toISOString();
    setLastReadAt(nowIso);
    try {
      localStorage.setItem(NOTIFICATIONS_READ_KEY, nowIso);
    } catch {
      // ignore
    }
  }, []);

  // Format user-friendly Realtime notification toast + store in top-right Notification Center
  const notifyRemoteActivity = useCallback(
    (updatedBy?: string, updatedAt?: string) => {
      let displayMsg = 'ข้อมูลผังตระกูลได้รับการอัปเดตเรียลไทม์แล้ว';
      if (updatedBy === 'admin_access_change') {
        displayMsg = 'แอดมินได้อัปเดตสิทธิ์การเข้าถึงของผังตระกูลแล้ว';
      } else if (updatedBy === 'admin_display_preset') {
        displayMsg = 'แอดมินส่งรูปแบบการแสดงผลใหม่มาให้แล้ว';
      } else if (updatedBy && updatedBy !== 'family_member' && updatedBy !== 'admin') {
        displayMsg = updatedBy;
      }
      pushNotification(displayMsg, { timestamp: updatedAt, isRemote: true });
      showToast(
        displayMsg === updatedBy ? `${displayMsg} (ซิงก์เรียลไทม์)` : displayMsg
      );
    },
    [showToast, pushNotification]
  );

  // Initial Cloud Connect + Dual Realtime Subscription + Live Online Presence + Smart 10s Fallback Poll
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    pullFromCloud(undefined, true);

    const handleIncomingSync = (ping: {
      updated_at?: string;
      updated_by?: string;
      source: 'broadcast' | 'postgres' | 'poll';
    }) => {
      const pingTs = ping.updated_at ? Date.parse(ping.updated_at) : Date.now();
      // Ignore echo of our own save (within 1.5s of our exact save timestamp)
      if (!Number.isNaN(pingTs) && Math.abs(pingTs - lastSavedStampRef.current) < 1500) {
        return;
      }
      // Deduplicate duplicate broadcast + postgres pings for the same change
      if (!Number.isNaN(pingTs) && pingTs <= lastKnownRemoteStampRef.current && ping.source !== 'broadcast') {
        return;
      }
      if (!Number.isNaN(pingTs)) {
        lastKnownRemoteStampRef.current = pingTs;
      }

      pullFromCloud(undefined, true).then((res) => {
        if (res?.ok) {
          notifyRemoteActivity(ping.updated_by || res.updated_by, ping.updated_at || res.updated_at);
        }
      });
    };

    const unsubscribe = subscribeToCloudSync(
      handleIncomingSync,
      setRealtimeConnected,
      setOnlineCount
    );

    // Lightweight check when returning to the tab or waking up mobile phone
    const checkLatestStatus = async () => {
      if (document.visibilityState !== 'visible') return;
      const status = await fetchCloudTreeStatus();
      if (!status?.updated_at) return;
      const remoteTs = Date.parse(status.updated_at);
      if (
        !Number.isNaN(remoteTs) &&
        remoteTs > lastKnownRemoteStampRef.current + 500 &&
        Math.abs(remoteTs - lastSavedStampRef.current) > 1500
      ) {
        handleIncomingSync({
          updated_at: status.updated_at,
          updated_by: status.updated_by,
          source: 'poll',
        });
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkLatestStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const pollId = window.setInterval(checkLatestStatus, 10000);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(pollId);
    };
  }, [pullFromCloud, notifyRemoteActivity]);

  // Debounced Auto-Save to Supabase Cloud with 3-way conflict-free merge (concurrent multi-user safe!)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!cloudInitializedRef.current) return;
    if (!access.canEdit || access.viewLocked) return;

    if (suppressNextCloudSaveRef.current) {
      suppressNextCloudSaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setCloudStatus('saving');

    saveTimerRef.current = window.setTimeout(async () => {
      const activityMsg = pendingActivityRef.current || 'อัปเดตข้อมูลผังตระกูล';
      const localSnapshot = data;
      const shouldForceOverwrite = forceOverwriteCloudRef.current;
      forceOverwriteCloudRef.current = false;

      let dataToSave = localSnapshot;
      let mergedWithRemote = false;
      let expectedUpdatedAt = lastKnownRemoteIsoRef.current;
      let finalRes: Awaited<ReturnType<typeof saveCloudFamilyTree>> | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (!shouldForceOverwrite) {
          const latestRemote = await fetchCloudFamilyTree(sessionPins);
          if (latestRemote.ok && latestRemote.exists && latestRemote.tree_data) {
            if (latestRemote.updated_at) {
              expectedUpdatedAt = latestRemote.updated_at;
              lastKnownRemoteIsoRef.current = latestRemote.updated_at;
            }
            const remoteValid = validateImportedData(latestRemote.tree_data);
            const remoteTs = latestRemote.updated_at ? Date.parse(latestRemote.updated_at) : 0;
            const base = lastSyncedBaseDataRef.current;
            const remoteChanged =
              Boolean(remoteValid) &&
              (attempt > 0 ||
                !base ||
                remoteValid!.updatedAt !== base.updatedAt ||
                (!Number.isNaN(remoteTs) && remoteTs > lastKnownRemoteStampRef.current + 50));

            if (remoteValid && remoteChanged) {
              const { merged, hadRemoteAdditionsOrEdits } = mergeFamilyTreeData(
                base,
                localSnapshot,
                remoteValid
              );
              dataToSave = merged;
              if (hadRemoteAdditionsOrEdits) mergedWithRemote = true;
            }
          }
        }

        const res = await saveCloudFamilyTree({
          treeData: dataToSave,
          editPin: sessionPins.editPin,
          adminPin: sessionPins.adminPin,
          editorName: activityMsg,
          expectedUpdatedAt,
          forceOverwrite: shouldForceOverwrite,
        });
        finalRes = res;

        if (res.ok || !res.conflict) {
          break;
        }
        // Another relative saved in the exact same millisecond -> loop to re-fetch & merge cleanly!
      }

      if (finalRes?.ok) {
        if (finalRes.updated_at) {
          lastKnownRemoteIsoRef.current = finalRes.updated_at;
        }
        const ts = finalRes.updated_at ? Date.parse(finalRes.updated_at) : Date.now();
        if (!Number.isNaN(ts)) {
          lastSavedStampRef.current = ts;
          lastKnownRemoteStampRef.current = Math.max(lastKnownRemoteStampRef.current, ts);
        }
        lastSyncedBaseDataRef.current = dataToSave;
        if (dataRef.current === localSnapshot) {
          hasUnsavedLocalChangesRef.current = false;
          if (mergedWithRemote) {
            suppressNextCloudSaveRef.current = true;
            setData(dataToSave);
            showToast('ผสานข้อมูลที่ญาติแก้พร้อมกันเรียบร้อย (ไม่ทับกัน)');
          }
        }
        setLastSyncedAt(finalRes.updated_at);
        setCloudStatus('synced');
      } else {
        setCloudStatus('error');
        showToast(finalRes?.error || 'บันทึกขึ้น Cloud ไม่สำเร็จ', 'error');
        pullFromCloud(undefined, true);
      }
    }, 350);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    data,
    access.canEdit,
    access.viewLocked,
    access.isAdmin,
    sessionPins,
    showToast,
    pullFromCloud,
  ]);

  const commitChange = useCallback(
    (nextData: FamilyTreeData, activityMessage = 'อัปเดตข้อมูลผังตระกูล') => {
      if (!access.canEdit) {
        showToast('ผังตระกูลถูกล็อกการแก้ไขอยู่ กรุณาปลดล็อกก่อน', 'error');
        return;
      }
      pendingActivityRef.current = activityMessage;
      hasUnsavedLocalChangesRef.current = true;
      pushNotification(activityMessage, { isRemote: false });
      setData(nextData);
    },
    [access.canEdit, showToast, pushNotification]
  );

  // Admin & Gate Handlers
  const handleUnlockViewGate = async (pin: string, asAdmin: boolean) => {
    setGateError('');
    if (!isSupabaseConfigured) {
      if (asAdmin) {
        if (pin !== localAccessCfg.adminPin) {
          setGateError('รหัสผ่านแอดมินไม่ถูกต้อง');
          return;
        }
        setSessionPins((prev) => ({ ...prev, adminPin: pin }));
      } else {
        if (pin !== localAccessCfg.viewPin && pin !== localAccessCfg.adminPin) {
          setGateError('รหัสผ่านเข้าบ้านไม่ถูกต้อง');
          return;
        }
        setSessionPins((prev) => ({ ...prev, viewPin: pin }));
      }
      return;
    }

    setGateLoading(true);
    const nextPins = asAdmin
      ? { ...sessionPins, adminPin: pin }
      : { ...sessionPins, viewPin: pin };
    const res = await pullFromCloud(nextPins, true);
    setGateLoading(false);

    if (!res || !res.ok || (asAdmin && !res.is_admin)) {
      setGateError(asAdmin ? 'รหัสผ่านแอดมินไม่ถูกต้อง' : 'รหัสผ่านเข้าบ้านไม่ถูกต้อง');
      return;
    }
    setSessionPins(nextPins);
  };

  const handleLoginAdmin = async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      if (pin !== localAccessCfg.adminPin) {
        return { ok: false, error: 'รหัสผ่านแอดมินไม่ถูกต้อง (ค่าเริ่มต้นคือ 1234)' };
      }
      setSessionPins((prev) => ({ ...prev, adminPin: pin }));
      return { ok: true };
    }

    const nextPins = { ...sessionPins, adminPin: pin };
    const res = await pullFromCloud(nextPins, true);
    if (!res) {
      return { ok: false, error: 'ไม่สามารถเชื่อมต่อ Supabase ได้' };
    }
    if (!res.ok) {
      return { ok: false, error: res.error || 'เชื่อมต่อ Supabase ไม่สำเร็จ (ตรวจสอบ API Key หรือ SQL)' };
    }
    if (!res.is_admin) {
      return { ok: false, error: 'รหัสผ่านแอดมินไม่ถูกต้อง' };
    }
    setSessionPins(nextPins);
    return { ok: true };
  };

  const handleLogoutAdmin = () => {
    const nextPins = { ...sessionPins, adminPin: '' };
    setSessionPins(nextPins);
    if (isSupabaseConfigured) {
      pullFromCloud(nextPins, true);
    }
    showToast('ออกจากโหมดแอดมินแล้ว');
  };

  const handleUnlockEditPin = async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      if (pin !== localAccessCfg.editPin && pin !== localAccessCfg.adminPin) {
        return { ok: false, error: 'รหัสผ่านแก้ไขไม่ถูกต้อง' };
      }
      setSessionPins((prev) => ({ ...prev, editPin: pin }));
      return { ok: true };
    }

    const nextPins = { ...sessionPins, editPin: pin };
    const res = await pullFromCloud(nextPins, true);
    if (!res || !res.ok) {
      return { ok: false, error: res?.error || 'เชื่อมต่อ Supabase ไม่สำเร็จ' };
    }
    if (!res.can_edit) {
      return { ok: false, error: 'รหัสผ่านแก้ไขไม่ถูกต้อง' };
    }
    setSessionPins(nextPins);
    return { ok: true };
  };

  const handleSaveAccessRules = async (rules: {
    viewMode: ViewAccessMode;
    editMode: EditAccessMode;
    newViewPin?: string;
    newEditPin?: string;
    newAdminPin?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      const nextCfg: LocalAccessConfig = {
        viewMode: rules.viewMode,
        editMode: rules.editMode,
        viewPin: rules.newViewPin || localAccessCfg.viewPin,
        editPin: rules.newEditPin || localAccessCfg.editPin,
        adminPin: rules.newAdminPin || localAccessCfg.adminPin,
      };
      setLocalAccessCfg(nextCfg);
      if (rules.newAdminPin) {
        setSessionPins((prev) => ({ ...prev, adminPin: rules.newAdminPin! }));
      }
      showToast('บันทึกสิทธิ์ล็อก/ปลดล็อกเรียบร้อยแล้ว');
      return { ok: true };
    }

    // Only create tree row on Cloud if it does not exist yet
    if (!lastKnownRemoteIsoRef.current) {
      const pushFirst = await saveCloudFamilyTree({
        treeData: data,
        adminPin: sessionPins.adminPin,
        editorName: 'admin',
      });
      if (!pushFirst.ok) {
        return { ok: false, error: pushFirst.error };
      }
      if (pushFirst.updated_at) {
        lastKnownRemoteIsoRef.current = pushFirst.updated_at;
      }
    }

    const res = await updateCloudAccessSettings({
      adminPin: sessionPins.adminPin,
      viewMode: rules.viewMode,
      editMode: rules.editMode,
      newViewPin: rules.newViewPin,
      newEditPin: rules.newEditPin,
      newAdminPin: rules.newAdminPin,
    });
    if (!res.ok) return res;

    const updatedPins = rules.newAdminPin
      ? { ...sessionPins, adminPin: rules.newAdminPin }
      : sessionPins;
    setSessionPins(updatedPins);
    await pullFromCloud(updatedPins, true);
    showToast('บันทึกสิทธิ์ล็อก/ปลดล็อกขึ้น Supabase เรียบร้อยแล้ว');
    return { ok: true };
  };

  const handleManualSyncPush = async () => {
    if (!isSupabaseConfigured) return;
    setCloudStatus('saving');
    let dataToSave = data;
    let mergedWithRemote = false;
    let expectedUpdatedAt = lastKnownRemoteIsoRef.current;

    const latestRemote = await fetchCloudFamilyTree(sessionPins);
    if (latestRemote.ok && latestRemote.exists && latestRemote.tree_data) {
      if (latestRemote.updated_at) {
        expectedUpdatedAt = latestRemote.updated_at;
        lastKnownRemoteIsoRef.current = latestRemote.updated_at;
      }
      const remoteValid = validateImportedData(latestRemote.tree_data);
      const base = lastSyncedBaseDataRef.current;
      if (remoteValid && (!base || remoteValid.updatedAt !== base.updatedAt)) {
        const { merged, hadRemoteAdditionsOrEdits } = mergeFamilyTreeData(base, data, remoteValid);
        dataToSave = merged;
        mergedWithRemote = hadRemoteAdditionsOrEdits;
      }
    }

    const res = await saveCloudFamilyTree({
      treeData: dataToSave,
      editPin: sessionPins.editPin,
      adminPin: sessionPins.adminPin,
      editorName: access.isAdmin ? 'แอดมินซิงก์ข้อมูลผังตระกูล' : 'อัปเดตข้อมูลผังตระกูล',
      expectedUpdatedAt,
    });
    if (res.ok) {
      if (res.updated_at) {
        lastKnownRemoteIsoRef.current = res.updated_at;
      }
      const ts = res.updated_at ? Date.parse(res.updated_at) : Date.now();
      if (!Number.isNaN(ts)) {
        lastSavedStampRef.current = ts;
        lastKnownRemoteStampRef.current = Math.max(lastKnownRemoteStampRef.current, ts);
      }
      lastSyncedBaseDataRef.current = dataToSave;
      hasUnsavedLocalChangesRef.current = false;
      if (mergedWithRemote) {
        suppressNextCloudSaveRef.current = true;
        setData(dataToSave);
      }
      setLastSyncedAt(res.updated_at);
      setCloudStatus('synced');
      showToast(
        mergedWithRemote
          ? 'ผสานข้อมูลที่ญาติแก้พร้อมกัน และส่งขึ้น Cloud เรียบร้อยแล้ว'
          : 'ส่งข้อมูลขึ้น Supabase Cloud เรียบร้อยแล้ว'
      );
    } else {
      setCloudStatus('error');
      showToast(res.error || 'ส่งข้อมูลไม่สำเร็จ', 'error');
    }
  };

  // Admin broadcasts their current Theme + Background + Card Style + Orientation to all other devices!
  const handlePushDisplayPresetToAll = async (): Promise<{ ok: boolean; error?: string }> => {
    if (!access.isAdmin) {
      return { ok: false, error: 'เฉพาะแอดมินเท่านั้นที่ส่งรูปแบบหน้าจอให้ทุกคนได้' };
    }
    const preset: SharedDisplayPreset = {
      themeSettings,
      cardStyle,
      orientation,
      pushedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(APPLIED_PRESET_KEY, preset.pushedAt);
    } catch {
      // ignore
    }

    if (!isSupabaseConfigured) {
      showToast('บันทึกรูปแบบการแสดงผลไว้แล้ว (จะส่งให้ทุกเครื่องเมื่อเชื่อม Supabase)');
      return { ok: true };
    }

    // Pull latest tree first so broadcasting display preset never overwrites recent member edits
    let treeToSave = data;
    let expectedUpdatedAt = lastKnownRemoteIsoRef.current;
    const latestRemote = await fetchCloudFamilyTree(sessionPins);
    if (latestRemote.ok && latestRemote.exists && latestRemote.tree_data) {
      if (latestRemote.updated_at) {
        expectedUpdatedAt = latestRemote.updated_at;
        lastKnownRemoteIsoRef.current = latestRemote.updated_at;
      }
      const remoteValid = validateImportedData(latestRemote.tree_data);
      if (remoteValid) {
        treeToSave = mergeFamilyTreeData(lastSyncedBaseDataRef.current, data, remoteValid).merged;
      }
    }

    const res = await saveCloudFamilyTree({
      treeData: treeToSave,
      themeSettings: preset,
      adminPin: sessionPins.adminPin,
      editorName: 'admin_display_preset',
      expectedUpdatedAt,
    });
    if (!res.ok) {
      return { ok: false, error: res.error || 'ไม่สามารถส่งรูปแบบการแสดงผลได้' };
    }
    if (res.updated_at) {
      lastKnownRemoteIsoRef.current = res.updated_at;
    }
    const ts = res.updated_at ? Date.parse(res.updated_at) : Date.now();
    if (!Number.isNaN(ts)) {
      lastSavedStampRef.current = ts;
      lastKnownRemoteStampRef.current = Math.max(lastKnownRemoteStampRef.current, ts);
    }
    setLastSyncedAt(res.updated_at);
    showToast('ส่งรูปแบบการแสดงผลปัจจุบันให้ทุกคนดูตามแล้ว');
    return { ok: true };
  };

  const fullLayoutForMeta = useMemo(() => computeFamilyTreeLayout(data), [data]);

  const branches = useMemo(() => {
    const set = new Set<string>();
    for (const m of Object.values(data.members)) {
      if (m.branch?.trim()) set.add(m.branch.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [data.members]);

  const activeHighlight = useMemo(() => {
    if (customHighlight) return customHighlight;
    if (lineageAnchorId && data.members[lineageAnchorId]) {
      const anchor = data.members[lineageAnchorId];
      return {
        ids: getLineageHighlightSet(data.members, lineageAnchorId),
        label: `สายตรงของ ${anchor.nickname || anchor.firstName}`,
      };
    }
    return null;
  }, [customHighlight, lineageAnchorId, data.members]);

  const previewPerson = previewPersonId ? data.members[previewPersonId] ?? null : null;
  const editingPerson = editingPersonId ? data.members[editingPersonId] ?? null : null;
  const activeSelectedPersonId = editingPersonId ?? previewPersonId;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.values(data.members)
      .filter(
        (m) =>
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          (m.nickname || '').toLowerCase().includes(q) ||
          (m.branch || '').toLowerCase().includes(q) ||
          (m.occupation || '').toLowerCase().includes(q) ||
          (m.notes || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [data.members, searchQuery]);

  const jumpToPersonOnTree = useCallback(
    (personId: string) => {
      if (!data.members[personId]) return;
      setView('tree');
      openPersonPreview(personId);
      setCollapsedIds(new Set());
      setTimeout(() => {
        treeCanvasRef.current?.focusPerson(personId);
      }, 80);
    },
    [data.members, openPersonPreview]
  );

  const handleSavePerson = (updated: Person) => {
    const label = updated.nickname ? `${updated.firstName} (${updated.nickname})` : updated.firstName;
    commitChange(upsertPerson(data, updated), `ข้อมูลของ ${label} ได้รับการแก้ไข`);
    showToast(`บันทึกข้อมูล ${label} แล้ว`);
  };

  const handleDeletePerson = (personId: string) => {
    const name = data.members[personId]?.firstName || 'สมาชิก';
    commitChange(deletePerson(data, personId), `ลบข้อมูล ${name} ออกจากผัง`);
    setPreviewPersonId(null);
    setEditingPersonId(null);
    if (focusRootId === personId) setFocusRootId(null);
    if (lineageAnchorId === personId) setLineageAnchorId(null);
    showToast(`ลบข้อมูล ${name} ออกจากผังแล้ว`);
  };

  const handleCreateQuickAdd = (fields: {
    firstName: string;
    lastName: string;
    nickname?: string;
    gender: Person['gender'];
    photo?: string;
    birthDate?: string;
    birthOrder?: number;
    isDeceased?: boolean;
    deathDate?: string;
    occupation?: string;
    branch?: string;
    notes?: string;
    spouseStatus?: SpouseStatus;
    otherParentId?: string;
  }) => {
    if (!quickAddState || !access.canEdit) return;
    const displayLabel = fields.nickname ? `${fields.firstName} (${fields.nickname})` : fields.firstName;
    if (quickAddState.relation === 'standalone' || !quickAddState.anchorId) {
      const newMember = createBlankPerson({
        firstName: fields.firstName,
        lastName: fields.lastName,
        nickname: fields.nickname,
        gender: fields.gender,
        photo: fields.photo,
        birthDate: fields.birthDate,
        birthOrder: fields.birthOrder,
        isDeceased: Boolean(fields.isDeceased),
        deathDate: fields.deathDate,
        occupation: fields.occupation,
        branch: fields.branch,
        notes: fields.notes,
      });
      commitChange(upsertPerson(data, newMember), `เพิ่มสมาชิกใหม่: ${displayLabel}`);
      setQuickAddState(null);
      openPersonPreview(newMember.id);
      showToast(`เพิ่ม ${displayLabel} เรียบร้อยแล้ว`);
      setTimeout(() => treeCanvasRef.current?.focusPerson(newMember.id), 100);
      return;
    }

    const res = addRelative(data, quickAddState.anchorId, quickAddState.relation, fields);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    commitChange(res.data, `เพิ่มสมาชิกใหม่: ${displayLabel}`);
    setQuickAddState(null);
    if (quickAddState.relation === 'child') {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        next.delete(quickAddState.anchorId!);
        return next;
      });
    }
    openPersonPreview(res.newPersonId);
    showToast(`เพิ่ม ${displayLabel} เข้าสู่ผังตระกูลแล้ว`);
    setTimeout(() => treeCanvasRef.current?.focusPerson(res.newPersonId), 120);
  };

  const handleLinkExisting = (existingPersonId: string, spouseStatus: SpouseStatus = 'married') => {
    if (!quickAddState || !quickAddState.anchorId || !access.canEdit) return;
    const anchorId = quickAddState.anchorId;
    const anchorName = data.members[anchorId]?.firstName || '';
    const existingName = data.members[existingPersonId]?.firstName || '';
    let res: { data: FamilyTreeData; error?: string } = { data };

    if (quickAddState.relation === 'child') {
      res = linkParentChild(data, anchorId, existingPersonId);
    } else if (quickAddState.relation === 'parent') {
      res = linkParentChild(data, existingPersonId, anchorId);
    } else if (quickAddState.relation === 'spouse') {
      res = linkSpouses(data, anchorId, existingPersonId, spouseStatus);
    }

    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    commitChange(res.data, `เชื่อมโยงสายสัมพันธ์: ${anchorName} กับ ${existingName}`);
    setQuickAddState(null);
    showToast('เชื่อมโยงสายสัมพันธ์เรียบร้อยแล้ว');
  };

  const handleToggleCollapse = (personId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const handleCollapseToLevel2 = () => {
    const toCollapse = new Set<string>();
    for (const card of fullLayoutForMeta.cards) {
      if (card.generation >= 2 && card.hasChildren) {
        toCollapse.add(card.person.id);
      }
    }
    setCollapsedIds(toCollapse);
    setTimeout(() => treeCanvasRef.current?.fitToScreen(), 80);
  };

  const memberCount = Object.keys(data.members).length;

  // IMPORTANT: All hooks (useMemo, useEffect, etc.) must stay ABOVE any early returns!
  const currentDisplaySummary = useMemo(() => {
    const styleLabel =
      cardStyle === 'photo-only'
        ? 'รูป+ชื่อ'
        : cardStyle === 'compact'
          ? 'กะทัดรัด'
          : 'ละเอียด';
    const orientLabel =
      orientation === 'left-right'
        ? 'แนวตั้ง'
        : orientation === 'bottom-up'
          ? 'ล่าง→บน'
          : 'บน→ล่าง';
    const bgLabel =
      themeSettings.bgType === 'tree'
        ? 'พื้นหลังต้นไม้'
        : themeSettings.bgType === 'house'
          ? 'พื้นหลังบ้าน'
          : themeSettings.bgType === 'botanical'
            ? 'สีน้ำพฤกษา'
            : themeSettings.bgType === 'custom'
              ? 'รูปพื้นหลังเอง'
              : 'ลายจุด';
    return `ธีม${palette.name} · ${bgLabel} · การ์ด${styleLabel} · ${orientLabel}`;
  }, [palette.name, themeSettings.bgType, cardStyle, orientation]);

  // If Admin locked View Access with PIN, show the Family Access Gate screen
  if (access.viewLocked) {
    return (
      <AccessGateScreen
        clanName={access.lockedClanName}
        palette={palette}
        error={gateError}
        loading={gateLoading}
        onUnlock={handleUnlockViewGate}
      />
    );
  }

  // Dedicated Elder-Friendly / Easy Viewing Mode
  if (simpleMode) {
    return (
      <SimpleView
        data={data}
        generationMap={fullLayoutForMeta.generationMap}
        branches={branches}
        themeSettings={themeSettings}
        palette={palette}
        onExitSimpleMode={() => setSimpleMode(false)}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden theme-app-bg">
      {/* Top Navigation Bar */}
      <header className="h-15 shrink-0 theme-surface border-b px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-3 z-30 shadow-2xs">
        {/* Left: Brand & Clan Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => {
              if (access.isAdmin) {
                setShowSettings(true);
              } else {
                showToast('หน้าตั้งค่าตระกูลสงวนสิทธิ์เฉพาะแอดมินเท่านั้น (กดปุ่มแอดมินเพื่อเข้าสู่ระบบ)', 'error');
              }
            }}
            className="flex items-center gap-2.5 group text-left min-w-0 cursor-pointer"
            title={access.isAdmin ? 'คลิกเพื่อตั้งค่าตระกูลและสำรองข้อมูล' : data.clanName}
          >
            <div
              style={{ backgroundColor: palette.primary }}
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs shrink-0 group-hover:opacity-90 transition-opacity"
            >
              <TreePine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold font-serif-thai truncate leading-tight">
                {data.clanName}
              </div>
              <div className="text-[11px] theme-muted-text flex items-center gap-1.5">
                <span className="hidden sm:inline">
                  {memberCount} สมาชิก · {fullLayoutForMeta.maxGeneration} รุ่น
                </span>
                <span className="hidden sm:inline">·</span>
                {isSupabaseConfigured ? (
                  <span className="inline-flex items-center gap-1.5" style={{ color: palette.primary }}>
                    <span className="inline-flex items-center gap-1">
                      {realtimeConnected && cloudStatus === 'synced' ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      ) : (
                        <Cloud className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">
                        {cloudStatus === 'saving'
                          ? 'กำลังซิงก์...'
                          : cloudStatus === 'synced'
                            ? realtimeConnected
                              ? 'เรียลไทม์'
                              : 'ซิงก์แล้ว'
                            : 'เชื่อมต่อ...'}
                      </span>
                    </span>
                    {realtimeConnected && (
                      <span
                        title={`กำลังมีคนเปิดดูผังตระกูลอยู่ ${onlineCount} เครื่องในขณะนี้`}
                        style={{
                          backgroundColor: palette.primarySoft,
                          color: palette.primary,
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      >
                        <Eye className="w-2.5 h-2.5" />
                        <span>กำลังดู {onlineCount} คน</span>
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="hidden sm:inline">บันทึกในเครื่อง</span>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Center: View Tabs */}
        <nav className="hidden md:flex items-center theme-subtle p-1 rounded-xl border">
          {(
            [
              { id: 'tree', label: 'ผังตระกูล', icon: TreePine },
              { id: 'directory', label: 'รายชื่อ', icon: Users },
              { id: 'kinship', label: 'ลำดับญาติ', icon: GitCompare },
              { id: 'overview', label: 'ภาพรวม', icon: BarChart3 },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={
                view === id
                  ? { backgroundColor: palette.bgSurface, color: palette.textMain }
                  : { color: palette.textMuted }
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                view === id ? 'shadow-xs' : 'hover:opacity-80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </nav>

        {/* Right: Search + Easy Mode + Theme + Admin Lock/Unlock + Undo/Redo + Add + Settings */}
        <div className="flex items-center gap-1.5">
          {/* Instant Jump Search */}
          <div className="relative hidden 2xl:block w-44">
            <Search className="w-3.5 h-3.5 theme-muted-text absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ / หมายเหตุ..."
              style={{ borderColor: palette.border, backgroundColor: palette.bgSubtle }}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 theme-muted-text cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {searchFocused && searchQuery.trim() && (
              <div className="absolute right-0 mt-1.5 w-72 theme-surface rounded-xl shadow-xl border overflow-hidden z-50">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-5 text-center text-xs theme-muted-text">
                    ไม่พบสมาชิกที่ตรงกับ "{searchQuery}"
                  </div>
                ) : (
                  <div
                    className="divide-y max-h-72 overflow-y-auto"
                    style={{ borderColor: palette.border }}
                  >
                    {searchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onMouseDown={() => {
                          jumpToPersonOnTree(m.id);
                          setSearchQuery('');
                        }}
                        className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-black/5 text-left cursor-pointer"
                      >
                        <PersonAvatar person={m} size="xs" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">
                            {getDisplayNameWithNickname(m)}
                          </div>
                          <div className="text-[10.5px] theme-muted-text truncate">
                            {m.branch || m.occupation || 'สมาชิกในผัง'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin Lock / Unlock & Cloud Control Button */}
          <button
            onClick={() => setShowAdminModal(true)}
            style={
              access.isAdmin
                ? { backgroundColor: palette.primarySoft, color: palette.primary, borderColor: palette.primary }
                : !access.canEdit
                  ? { backgroundColor: palette.accentSoft, color: palette.accent, borderColor: palette.accent }
                  : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-85 transition-opacity cursor-pointer"
            title="ระบบแอดมิน: ล็อก/ปลดล็อกสิทธิ์ดูและแก้ไข + ซิงก์ Supabase"
          >
            {access.isAdmin ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : !access.canEdit ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
            <span className="hidden lg:inline">
              {access.isAdmin ? 'แอดมิน' : !access.canEdit ? 'ล็อกอยู่' : 'แอดมิน/สิทธิ์'}
            </span>
          </button>

          {/* Easy Mode (โหมดดูง่าย) button */}
          <button
            onClick={() => setSimpleMode(true)}
            style={{
              backgroundColor: palette.accentSoft,
              color: palette.accent,
              borderColor: palette.border,
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold hover:opacity-85 transition-opacity cursor-pointer"
            title="เปิดโหมดดูง่าย (ตัวอักษรใหญ่ อ่านสบายตา)"
          >
            <BookOpenCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ดูง่าย</span>
          </button>

          {/* Theme & Background Studio button */}
          <button
            onClick={() => setShowThemePicker(true)}
            style={{
              backgroundColor: palette.bgSubtle,
              borderColor: palette.border,
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium hover:opacity-85 transition-opacity cursor-pointer"
            title="เปลี่ยนธีมสี & พื้นหลังผังตระกูล"
          >
            <Palette className="w-3.5 h-3.5" style={{ color: palette.primary }} />
            <span className="hidden xl:inline">ธีม/พื้นหลัง</span>
          </button>

          {/* Public Export / Download PNG / Sheet / Backup button (Everyone can use!) */}
          <button
            onClick={() => setShowExportModal(true)}
            style={{
              backgroundColor: palette.bgSubtle,
              borderColor: palette.border,
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium hover:opacity-85 transition-opacity cursor-pointer"
            title="ดาวน์โหลดภาพผังตระกูล / คัดลอกหรือส่งออกเป็น Sheet / สำรองข้อมูล (ทุกคนใช้ได้)"
          >
            <Download className="w-3.5 h-3.5" style={{ color: palette.primary }} />
            <span className="hidden xl:inline">ส่งออก/ชีต</span>
          </button>

          {/* Facebook-style Activity Notification Bell & History Popup */}
          <NotificationCenter
            data={data}
            notifications={notifications}
            lastReadAt={lastReadAt}
            palette={palette}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onSelectPerson={(id) => jumpToPersonOnTree(id)}
          />

          {access.canEdit && (
            <button
              onClick={() => setQuickAddState({ anchorId: null, relation: 'standalone' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl theme-primary-btn text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เพิ่มสมาชิก</span>
            </button>
          )}

          {access.isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              title="ตั้งค่าตระกูล / สำรองไฟล์ / ส่งออกภาพ (เฉพาะแอดมิน)"
              className="p-2 rounded-xl border theme-surface hover:opacity-85 transition-opacity cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Read-only banner when Admin locked editing */}
      {!access.canEdit && (
        <div
          style={{ backgroundColor: palette.accentSoft, borderColor: palette.border, color: palette.textMain }}
          className="px-4 py-1.5 border-b text-xs flex items-center justify-center gap-2 shrink-0"
        >
          <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: palette.accent }} />
          <span>
            {access.editMode === 'pin'
              ? 'กำลังดูอย่างเดียว — ต้องใส่รหัสแก้ไขก่อนจึงจะปรับแก้ข้อมูลได้'
              : 'แอดมินได้ล็อกการแก้ไขไว้ชั่วคราว (ดูข้อมูลและค้นหาญาติได้ตามปกติ)'}
          </span>
          <button
            onClick={() => setShowAdminModal(true)}
            style={{ color: palette.accent }}
            className="font-bold underline cursor-pointer shrink-0"
          >
            ปลดล็อก / แอดมิน
          </button>
        </div>
      )}

      {/* Mobile Tab Bar */}
      <div className="flex md:hidden items-center justify-around theme-surface border-b px-2 py-1.5 shrink-0">
        {(
          [
            { id: 'tree', label: 'ผังตระกูล', icon: TreePine },
            { id: 'directory', label: 'รายชื่อ', icon: Users },
            { id: 'kinship', label: 'ลำดับญาติ', icon: GitCompare },
            { id: 'overview', label: 'ภาพรวม', icon: BarChart3 },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={
              view === id
                ? { backgroundColor: palette.primarySoft, color: palette.primary }
                : { color: palette.textMuted }
            }
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {view === 'tree' && (
          <TreeCanvas
            ref={treeCanvasRef}
            data={data}
            selectedPersonId={activeSelectedPersonId}
            highlightIds={activeHighlight?.ids ?? null}
            highlightLabel={activeHighlight?.label ?? null}
            onClearHighlight={() => {
              setLineageAnchorId(null);
              setCustomHighlight(null);
            }}
            focusRootId={focusRootId}
            onClearFocusRoot={() => setFocusRootId(null)}
            cardStyle={cardStyle}
            onChangeCardStyle={setCardStyle}
            orientation={orientation}
            onChangeOrientation={setOrientation}
            collapsedIds={collapsedIds}
            onToggleCollapse={handleToggleCollapse}
            onExpandAll={() => {
              setCollapsedIds(new Set());
              setTimeout(() => treeCanvasRef.current?.fitToScreen(), 80);
            }}
            onCollapseToLevel2={handleCollapseToLevel2}
            onSelectPerson={(id) => openPersonPreview(id)}
            onOpenCoupleDetail={(personAId, personBId) =>
              setCoupleModalState({ personAId, personBId })
            }
            onQuickAdd={(anchorId, relation) => {
              if (!access.canEdit) {
                setShowAdminModal(true);
                return;
              }
              setQuickAddState({ anchorId, relation });
            }}
            onAddStandalone={() => {
              if (!access.canEdit) {
                setShowAdminModal(true);
                return;
              }
              setQuickAddState({ anchorId: null, relation: 'standalone' });
            }}
            branches={branches}
            themeSettings={themeSettings}
            palette={palette}
            readOnly={!access.canEdit}
          />
        )}

        {view === 'directory' && (
          <DirectoryView
            data={data}
            generationMap={fullLayoutForMeta.generationMap}
            branches={branches}
            canEdit={access.canEdit}
            onSelectAndInspect={(id) => openPersonPreview(id)}
            onJumpToTree={jumpToPersonOnTree}
            onAddStandalone={() => setQuickAddState({ anchorId: null, relation: 'standalone' })}
          />
        )}

        {view === 'kinship' && (
          <KinshipView
            data={data}
            onHighlightPathOnTree={(pathIds, label) => {
              setLineageAnchorId(null);
              setCustomHighlight({ ids: new Set(pathIds), label });
              setCollapsedIds(new Set());
              setFocusRootId(null);
              setView('tree');
              setTimeout(() => {
                treeCanvasRef.current?.fitToScreen();
              }, 100);
            }}
          />
        )}

        {view === 'overview' && (
          <OverviewView
            data={data}
            generationMap={fullLayoutForMeta.generationMap}
            canEdit={access.canEdit}
            onSelectPerson={(id) => openPersonPreview(id)}
            onOpenCoupleDetail={(personAId, personBId) =>
              setCoupleModalState({ personAId, personBId })
            }
          />
        )}

        {/* Right Slide-Over Person Editor Drawer (opened when clicking "แก้ไขข้อมูล" in Preview Popup) */}
        {editingPerson && (
          <PersonDrawer
            data={data}
            person={editingPerson}
            generation={fullLayoutForMeta.generationMap[editingPerson.id]}
            existingBranches={branches}
            isLineageHighlighted={lineageAnchorId === editingPerson.id}
            canEdit={access.canEdit}
            initialEditMode={true}
            onClose={() => setEditingPersonId(null)}
            onSavePerson={handleSavePerson}
            onDeletePerson={handleDeletePerson}
            onSelectPerson={(id) => {
              openPersonPreview(id);
              if (view === 'tree') {
                treeCanvasRef.current?.focusPerson(id);
              }
            }}
            onOpenCoupleDetail={(personAId, personBId) =>
              setCoupleModalState({ personAId, personBId })
            }
            onReorderChildren={(orderedChildIds) => {
              commitChange(reorderChildren(data, orderedChildIds), 'ปรับลำดับพี่น้องในครอบครัวแล้ว');
              showToast('ปรับลำดับพี่น้องเรียบร้อยแล้ว');
            }}
            onQuickAdd={(anchorId, relation) => setQuickAddState({ anchorId, relation })}
            onUnlinkParent={(parentId, childId) => {
              const childName = data.members[childId]?.firstName || '';
              commitChange(
                unlinkParentChild(data, parentId, childId),
                `แก้ไขสายสัมพันธ์ของ ${childName}`
              );
              showToast('ยกเลิกการเชื่อมโยงพ่อ/แม่แล้ว');
            }}
            onUnlinkSpouse={(aId, bId) => {
              const nameA = data.members[aId]?.firstName || '';
              commitChange(unlinkSpouses(data, aId, bId), `แก้ไขคู่สมรสของ ${nameA}`);
              showToast('ยกเลิกการเชื่อมโยงคู่สมรสแล้ว');
            }}
            onUpdateSpouseStatus={(aId, bId, status, marriageDate) => {
              const nameA = data.members[aId]?.firstName || '';
              commitChange(
                updateSpouseStatus(data, aId, bId, status, marriageDate),
                `อัปเดตสถานะคู่สมรสของ ${nameA}`
              );
              showToast('อัปเดตสถานะคู่สมรสแล้ว');
            }}
            onToggleLineageHighlight={(id) => {
              setCustomHighlight(null);
              setLineageAnchorId((prev) => (prev === id ? null : id));
              if (view !== 'tree') setView('tree');
            }}
            onFocusSubtree={(id) => {
              setFocusRootId(id);
              setCollapsedIds(new Set());
              setView('tree');
            }}
          />
        )}
      </main>

      {/* Compact Person Detail Preview Popup (opens first when clicking any member) */}
      {previewPerson && (
        <PersonPreviewModal
          data={data}
          person={previewPerson}
          generation={fullLayoutForMeta.generationMap[previewPerson.id]}
          palette={palette}
          canEdit={access.canEdit}
          isLineageHighlighted={lineageAnchorId === previewPerson.id}
          onClose={() => setPreviewPersonId(null)}
          onOpenFullEditor={(id) => openPersonEditor(id)}
          onSelectPerson={(id) => {
            openPersonPreview(id);
            if (view === 'tree') {
              treeCanvasRef.current?.focusPerson(id);
            }
          }}
          onOpenCoupleDetail={(personAId, personBId) => {
            setPreviewPersonId(null);
            setCoupleModalState({ personAId, personBId });
          }}
          onQuickAdd={(anchorId, relation) => {
            setPreviewPersonId(null);
            setQuickAddState({ anchorId, relation });
          }}
          onToggleLineageHighlight={(id) => {
            setCustomHighlight(null);
            setLineageAnchorId((prev) => (prev === id ? null : id));
            setPreviewPersonId(null);
            if (view !== 'tree') setView('tree');
          }}
          onFocusSubtree={(id) => {
            setFocusRootId(id);
            setCollapsedIds(new Set());
            setPreviewPersonId(null);
            setView('tree');
          }}
        />
      )}

      {/* Couple / Household Detail Settings Modal */}
      {coupleModalState && (
        <CoupleDetailModal
          data={data}
          personAId={coupleModalState.personAId}
          personBId={coupleModalState.personBId}
          palette={palette}
          canEdit={access.canEdit}
          onClose={() => setCoupleModalState(null)}
          onSaveDetails={(aId, bId, details) => {
            const label =
              details.familyName?.trim() ||
              `${data.members[aId]?.firstName || ''} & ${data.members[bId]?.firstName || ''}`;
            commitChange(
              updateSpouseDetails(data, aId, bId, details),
              `ข้อมูลครอบครัว ${label} ได้รับการแก้ไข`
            );
            showToast('บันทึกรายละเอียดคู่ครอบครัวเรียบร้อยแล้ว');
          }}
          onReorderChildren={(orderedChildIds) => {
            commitChange(reorderChildren(data, orderedChildIds), 'ปรับลำดับพี่น้องในครอบครัวแล้ว');
            showToast('ปรับลำดับพี่น้องเรียบร้อยแล้ว');
          }}
          onSelectPerson={(id) => {
            setCoupleModalState(null);
            openPersonPreview(id);
            if (view === 'tree') {
              treeCanvasRef.current?.focusPerson(id);
            }
          }}
        />
      )}

      {/* Public Export / Download Image / Google Sheets & Excel Modal (Accessible to everyone!) */}
      {showExportModal && (
        <ExportShareModal
          data={data}
          generationMap={fullLayoutForMeta.generationMap}
          palette={palette}
          onClose={() => setShowExportModal(false)}
          onExportPng={() =>
            exportTreeAsPng(data, { cardStyle, orientation, collapsedIds, focusRootId, palette })
          }
        />
      )}

      {/* Quick Add Modal */}
      {quickAddState && access.canEdit && (
        <QuickAddModal
          data={data}
          anchorPerson={quickAddState.anchorId ? data.members[quickAddState.anchorId] ?? null : null}
          relation={quickAddState.relation}
          existingBranches={branches}
          onClose={() => setQuickAddState(null)}
          onCreateNew={handleCreateQuickAdd}
          onLinkExisting={handleLinkExisting}
        />
      )}

      {/* Admin Lock/Unlock & Supabase Sync Modal */}
      {showAdminModal && (
        <AdminAccessModal
          access={access}
          cloudStatus={cloudStatus}
          lastSyncedAt={lastSyncedAt}
          palette={palette}
          currentDisplaySummary={currentDisplaySummary}
          onClose={() => setShowAdminModal(false)}
          onLoginAdmin={handleLoginAdmin}
          onLogoutAdmin={handleLogoutAdmin}
          onUnlockEditPin={handleUnlockEditPin}
          onSaveAccessRules={handleSaveAccessRules}
          onPushDisplayPresetToAll={handlePushDisplayPresetToAll}
          onManualSyncPull={async () => {
            const res = await pullFromCloud(undefined, false);
            if (res?.ok) showToast('ดึงข้อมูลล่าสุดจาก Cloud เรียบร้อยแล้ว');
          }}
          onManualSyncPush={handleManualSyncPush}
          onLoadHistory={() => fetchCloudTreeHistory(sessionPins.adminPin, 50)}
          onRestoreHistoryVersion={async (historyId) => {
            const res = await restoreCloudTreeVersion(sessionPins.adminPin, historyId);
            if (!res.ok) return { ok: false, error: res.error };
            hasUnsavedLocalChangesRef.current = false;
            await pullFromCloud(undefined, true);
            showToast('กู้คืนข้อมูลย้อนหลังเรียบร้อยแล้ว!');
            return { ok: true };
          }}
        />
      )}

      {/* Theme & Canvas Background Modal */}
      {showThemePicker && (
        <ThemePickerModal
          settings={themeSettings}
          palette={palette}
          onChange={setThemeSettings}
          onClose={() => setShowThemePicker(false)}
        />
      )}

      {/* Clan Settings / Backup / Export Modal (STRICTLY ADMIN ONLY!) */}
      {showSettings && access.isAdmin && (
        <ClanSettingsModal
          data={data}
          isAdmin={access.isAdmin}
          onClose={() => setShowSettings(false)}
          onOpenAdminLogin={() => setShowAdminModal(true)}
          onUpdateClanInfo={(clanName, motto) => {
            if (!access.isAdmin) {
              showToast('เฉพาะแอดมินเท่านั้นที่เปลี่ยนชื่อตระกูลได้', 'error');
              return;
            }
            commitChange({
              ...data,
              clanName,
              motto,
              updatedAt: new Date().toISOString(),
            });
          }}
          onImportData={(imported) => {
            if (!access.isAdmin) {
              showToast('เฉพาะแอดมินเท่านั้นที่นำเข้าไฟล์ได้', 'error');
              return;
            }
            forceOverwriteCloudRef.current = true;
            commitChange(imported, `แอดมินนำเข้าข้อมูลตระกูล ${imported.clanName}`);
            setPreviewPersonId(null);
            setEditingPersonId(null);
            setFocusRootId(null);
            setCollapsedIds(new Set());
            setLineageAnchorId(null);
            setCustomHighlight(null);
            showToast(`นำเข้าข้อมูล "${imported.clanName}" เรียบร้อยแล้ว`);
            setTimeout(() => treeCanvasRef.current?.fitToScreen(), 120);
          }}
          onExportPng={() =>
            exportTreeAsPng(data, { cardStyle, orientation, collapsedIds, focusRootId, palette })
          }
          onResetSample={() => {
            if (!access.isAdmin) {
              showToast('เฉพาะแอดมินเท่านั้นที่รีเซ็ตข้อมูลได้', 'error');
              return;
            }
            forceOverwriteCloudRef.current = true;
            commitChange(createSampleFamilyTree(), 'แอดมินโหลดข้อมูลตัวอย่างใหม่');
            setPreviewPersonId(null);
            setEditingPersonId(null);
            setFocusRootId(null);
            setCollapsedIds(new Set());
            setLineageAnchorId(null);
            setCustomHighlight(null);
            showToast('โหลดข้อมูลตัวอย่างเรียบร้อยแล้ว');
            setTimeout(() => treeCanvasRef.current?.fitToScreen(), 120);
          }}
          onStartFresh={(newClanName) => {
            if (!access.isAdmin) {
              showToast('เฉพาะแอดมินเท่านั้นที่สร้างตระกูลใหม่ได้', 'error');
              return;
            }
            const fresh = createEmptyFamilyTree(newClanName);
            forceOverwriteCloudRef.current = true;
            commitChange(fresh, `แอดมินสร้างผังตระกูลใหม่ ${newClanName}`);
            openPersonPreview(fresh.rootPersonId ?? null);
            setFocusRootId(null);
            setCollapsedIds(new Set());
            setLineageAnchorId(null);
            setCustomHighlight(null);
            setView('tree');
            showToast(`สร้างผังตระกูล "${newClanName}" แล้ว`);
            setTimeout(() => treeCanvasRef.current?.fitToScreen(), 120);
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium animate-fade-in ${
            toast.type === 'error'
              ? 'bg-[#FCEEEB] border-[#ECC5BC] text-[#8E3224]'
              : 'bg-[#1C2B26] border-[#2E6254] text-white'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#7BD4B3] shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
};

export default App;
