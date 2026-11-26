import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TreePine,
  Users,
  GitCompare,
  BarChart3,
  Search,
  Undo2,
  Redo2,
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
} from 'lucide-react';
import {
  FamilyTreeData,
  Person,
  QuickAddRelation,
  SpouseStatus,
  ThemeSettings,
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
  unlinkParentChild,
  unlinkSpouses,
  updateSpouseStatus,
  upsertPerson,
  validateImportedData,
} from './utils/familyOps';
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
  isSupabaseConfigured,
  saveCloudFamilyTree,
  subscribeToCloudSync,
  updateCloudAccessSettings,
} from './lib/supabase';
import { TreeCanvas, TreeCanvasHandle } from './components/TreeCanvas';
import { PersonDrawer } from './components/PersonDrawer';
import { QuickAddModal } from './components/QuickAddModal';
import { DirectoryView } from './components/DirectoryView';
import { KinshipView } from './components/KinshipView';
import { OverviewView } from './components/OverviewView';
import { ClanSettingsModal } from './components/ClanSettingsModal';
import { ThemePickerModal } from './components/ThemePickerModal';
import { SimpleView } from './components/SimpleView';
import { AdminAccessModal } from './components/AdminAccessModal';
import { AccessGateScreen } from './components/AccessGateScreen';
import { PersonAvatar } from './components/PersonAvatar';

const STORAGE_KEY = 'thai_family_tree_v1';
const LOCAL_ACCESS_KEY = 'thai_family_tree_local_access_v1';
const SESSION_PINS_KEY = 'thai_family_tree_session_pins_v1';
const MAX_HISTORY = 40;

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
  const [past, setPast] = useState<FamilyTreeData[]>([]);
  const [future, setFuture] = useState<FamilyTreeData[]>([]);

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

  // Refs to prevent save loops when applying incoming Realtime updates
  const suppressNextCloudSaveRef = useRef(false);
  const lastSavedStampRef = useRef<string>('');
  const cloudInitializedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const [view, setView] = useState<ViewMode>('tree');
  const [simpleMode, setSimpleMode] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [focusRootId, setFocusRootId] = useState<string | null>(null);

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
  const [showAdminModal, setShowAdminModal] = useState(false);

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
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
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

  // Auto-save family tree to localStorage backup
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      showToast('พื้นที่จัดเก็บในเบราว์เซอร์เต็ม แนะนำให้สำรองไฟล์ JSON', 'error');
    }
  }, [data, showToast]);

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
      if (res.updated_at) setLastSyncedAt(res.updated_at);

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
          suppressNextCloudSaveRef.current = true;
          setData(valid);
        }
        if (res.theme_settings) {
          suppressNextCloudSaveRef.current = true;
          setThemeSettings((prev) => ({ ...prev, ...res.theme_settings }));
        }
      }

      cloudInitializedRef.current = true;
      return res;
    },
    [sessionPins, showToast]
  );

  // Initial Cloud Connect + Realtime Subscription
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    pullFromCloud(undefined, true);

    const unsubscribe = subscribeToCloudSync((ping) => {
      // Ignore our own echo within 2 seconds
      if (ping.updated_at && ping.updated_at === lastSavedStampRef.current) return;
      pullFromCloud(undefined, true).then((res) => {
        if (res?.ok && ping.updated_by !== 'admin_access_change') {
          showToast('ซิงก์ข้อมูลล่าสุดจากสมาชิกในครอบครัวแล้ว');
        } else if (ping.updated_by === 'admin_access_change') {
          showToast('แอดมินได้อัปเดตสิทธิ์การเข้าถึงของผังตระกูล');
        }
      });
    });

    return () => unsubscribe();
  }, [pullFromCloud, showToast]);

  // Debounced Auto-Save to Supabase Cloud whenever data or theme changes
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
      const res = await saveCloudFamilyTree({
        treeData: data,
        themeSettings,
        editPin: sessionPins.editPin,
        adminPin: sessionPins.adminPin,
        editorName: access.isAdmin ? 'admin' : 'family_member',
      });
      if (res.ok) {
        lastSavedStampRef.current = res.updated_at || '';
        setLastSyncedAt(res.updated_at);
        setCloudStatus('synced');
      } else {
        setCloudStatus('error');
        showToast(res.error || 'บันทึกขึ้น Cloud ไม่สำเร็จ', 'error');
        // Refresh access state in case admin just locked editing
        pullFromCloud(undefined, true);
      }
    }, 650);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [
    data,
    themeSettings,
    access.canEdit,
    access.viewLocked,
    access.isAdmin,
    sessionPins.editPin,
    sessionPins.adminPin,
    showToast,
    pullFromCloud,
  ]);

  const commitChange = useCallback(
    (nextData: FamilyTreeData) => {
      if (!access.canEdit) {
        showToast('ผังตระกูลถูกล็อกการแก้ไขอยู่ กรุณาปลดล็อกก่อน', 'error');
        return;
      }
      setData((prev) => {
        setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), prev]);
        setFuture([]);
        return nextData;
      });
    },
    [access.canEdit, showToast]
  );

  const handleUndo = useCallback(() => {
    if (!access.canEdit) return;
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      setFuture((f) => [data, ...f]);
      setData(previous);
      showToast('ย้อนกลับการแก้ไขล่าสุดแล้ว');
      return prevPast.slice(0, -1);
    });
  }, [access.canEdit, data, showToast]);

  const handleRedo = useCallback(() => {
    if (!access.canEdit) return;
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      setPast((p) => [...p, data]);
      setData(next);
      showToast('ทำซ้ำการแก้ไขแล้ว');
      return prevFuture.slice(1);
    });
  }, [access.canEdit, data, showToast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (inInput || simpleMode || !access.canEdit) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, simpleMode, access.canEdit]);

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

    // Ensure tree exists on Cloud first before updating access rules
    const pushFirst = await saveCloudFamilyTree({
      treeData: data,
      themeSettings,
      adminPin: sessionPins.adminPin,
      editorName: 'admin',
    });
    if (!pushFirst.ok) {
      return { ok: false, error: pushFirst.error };
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
    const res = await saveCloudFamilyTree({
      treeData: data,
      themeSettings,
      editPin: sessionPins.editPin,
      adminPin: sessionPins.adminPin,
      editorName: access.isAdmin ? 'admin' : 'family_member',
    });
    if (res.ok) {
      lastSavedStampRef.current = res.updated_at || '';
      setLastSyncedAt(res.updated_at);
      setCloudStatus('synced');
      showToast('ส่งข้อมูลขึ้น Supabase Cloud เรียบร้อยแล้ว');
    } else {
      setCloudStatus('error');
      showToast(res.error || 'ส่งข้อมูลไม่สำเร็จ', 'error');
    }
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

  const selectedPerson = selectedPersonId ? data.members[selectedPersonId] ?? null : null;

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
      setSelectedPersonId(personId);
      setCollapsedIds(new Set());
      setTimeout(() => {
        treeCanvasRef.current?.focusPerson(personId);
      }, 80);
    },
    [data.members]
  );

  const handleSavePerson = (updated: Person) => {
    commitChange(upsertPerson(data, updated));
    showToast(`บันทึกข้อมูล ${updated.firstName} แล้ว`);
  };

  const handleDeletePerson = (personId: string) => {
    const name = data.members[personId]?.firstName || 'สมาชิก';
    commitChange(deletePerson(data, personId));
    setSelectedPersonId(null);
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
    isDeceased?: boolean;
    deathDate?: string;
    occupation?: string;
    branch?: string;
    notes?: string;
    spouseStatus?: SpouseStatus;
    otherParentId?: string;
  }) => {
    if (!quickAddState || !access.canEdit) return;
    if (quickAddState.relation === 'standalone' || !quickAddState.anchorId) {
      const newMember = createBlankPerson({
        firstName: fields.firstName,
        lastName: fields.lastName,
        nickname: fields.nickname,
        gender: fields.gender,
        photo: fields.photo,
        birthDate: fields.birthDate,
        isDeceased: Boolean(fields.isDeceased),
        deathDate: fields.deathDate,
        occupation: fields.occupation,
        branch: fields.branch,
        notes: fields.notes,
      });
      commitChange(upsertPerson(data, newMember));
      setQuickAddState(null);
      setSelectedPersonId(newMember.id);
      showToast(`เพิ่ม ${newMember.firstName} เรียบร้อยแล้ว`);
      setTimeout(() => treeCanvasRef.current?.focusPerson(newMember.id), 100);
      return;
    }

    const res = addRelative(data, quickAddState.anchorId, quickAddState.relation, fields);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    commitChange(res.data);
    setQuickAddState(null);
    if (quickAddState.relation === 'child') {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        next.delete(quickAddState.anchorId!);
        return next;
      });
    }
    setSelectedPersonId(res.newPersonId);
    showToast(`เพิ่ม ${fields.firstName} เข้าสู่ผังตระกูลแล้ว`);
    setTimeout(() => treeCanvasRef.current?.focusPerson(res.newPersonId), 120);
  };

  const handleLinkExisting = (existingPersonId: string, spouseStatus: SpouseStatus = 'married') => {
    if (!quickAddState || !quickAddState.anchorId || !access.canEdit) return;
    const anchorId = quickAddState.anchorId;
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
    commitChange(res.data);
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

  const memberCount = Object.keys(data.members).length;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden theme-app-bg">
      {/* Top Navigation Bar */}
      <header className="h-15 shrink-0 theme-surface border-b px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-3 z-30 shadow-2xs">
        {/* Left: Brand & Clan Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2.5 group text-left min-w-0 cursor-pointer"
            title="คลิกเพื่อแก้ไขชื่อตระกูลหรือสำรองข้อมูล"
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
              <div className="text-[11px] theme-muted-text hidden sm:flex items-center gap-1.5">
                <span>
                  {memberCount} สมาชิก · {fullLayoutForMeta.maxGeneration} รุ่น
                </span>
                <span>·</span>
                {isSupabaseConfigured ? (
                  <span className="inline-flex items-center gap-1" style={{ color: palette.primary }}>
                    <Cloud className="w-3 h-3" />
                    {cloudStatus === 'saving'
                      ? 'กำลังซิงก์...'
                      : cloudStatus === 'synced'
                        ? 'Cloud ซิงก์แล้ว'
                        : 'กำลังเชื่อมต่อ'}
                  </span>
                ) : (
                  <span>บันทึกในเครื่อง</span>
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

          {/* Undo / Redo (only when canEdit) */}
          {access.canEdit && (
            <div className="hidden sm:flex items-center border rounded-xl theme-subtle p-0.5">
              <button
                onClick={handleUndo}
                disabled={past.length === 0}
                title="ย้อนกลับ (Ctrl+Z)"
                className="p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={future.length === 0}
                title="ทำซ้ำ (Ctrl+Y)"
                className="p-1.5 rounded-lg hover:bg-black/5 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {access.canEdit && (
            <button
              onClick={() => setQuickAddState({ anchorId: null, relation: 'standalone' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl theme-primary-btn text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เพิ่มสมาชิก</span>
            </button>
          )}

          <button
            onClick={() => setShowSettings(true)}
            title="ตั้งค่าตระกูล / สำรองไฟล์ / ส่งออกภาพ"
            className="p-2 rounded-xl border theme-surface hover:opacity-85 transition-opacity cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
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
            selectedPersonId={selectedPersonId}
            highlightIds={activeHighlight?.ids ?? null}
            highlightLabel={activeHighlight?.label ?? null}
            onClearHighlight={() => {
              setLineageAnchorId(null);
              setCustomHighlight(null);
            }}
            focusRootId={focusRootId}
            onClearFocusRoot={() => setFocusRootId(null)}
            compact={compact}
            onToggleCompact={() => setCompact((c) => !c)}
            collapsedIds={collapsedIds}
            onToggleCollapse={handleToggleCollapse}
            onExpandAll={() => {
              setCollapsedIds(new Set());
              setTimeout(() => treeCanvasRef.current?.fitToScreen(), 80);
            }}
            onCollapseToLevel2={handleCollapseToLevel2}
            onSelectPerson={(id) => setSelectedPersonId(id)}
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
            onSelectAndInspect={(id) => setSelectedPersonId(id)}
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
            onSelectPerson={(id) => setSelectedPersonId(id)}
          />
        )}

        {/* Right Slide-Over Person Inspector / Editor Drawer */}
        {selectedPerson && (
          <PersonDrawer
            data={data}
            person={selectedPerson}
            generation={fullLayoutForMeta.generationMap[selectedPerson.id]}
            existingBranches={branches}
            isLineageHighlighted={lineageAnchorId === selectedPerson.id}
            canEdit={access.canEdit}
            onClose={() => setSelectedPersonId(null)}
            onSavePerson={handleSavePerson}
            onDeletePerson={handleDeletePerson}
            onSelectPerson={(id) => {
              setSelectedPersonId(id);
              if (view === 'tree') {
                treeCanvasRef.current?.focusPerson(id);
              }
            }}
            onQuickAdd={(anchorId, relation) => setQuickAddState({ anchorId, relation })}
            onUnlinkParent={(parentId, childId) => {
              commitChange(unlinkParentChild(data, parentId, childId));
              showToast('ยกเลิกการเชื่อมโยงพ่อ/แม่แล้ว');
            }}
            onUnlinkSpouse={(aId, bId) => {
              commitChange(unlinkSpouses(data, aId, bId));
              showToast('ยกเลิกการเชื่อมโยงคู่สมรสแล้ว');
            }}
            onUpdateSpouseStatus={(aId, bId, status, marriageDate) => {
              commitChange(updateSpouseStatus(data, aId, bId, status, marriageDate));
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
          onClose={() => setShowAdminModal(false)}
          onLoginAdmin={handleLoginAdmin}
          onLogoutAdmin={handleLogoutAdmin}
          onUnlockEditPin={handleUnlockEditPin}
          onSaveAccessRules={handleSaveAccessRules}
          onManualSyncPull={async () => {
            const res = await pullFromCloud(undefined, false);
            if (res?.ok) showToast('ดึงข้อมูลล่าสุดจาก Cloud เรียบร้อยแล้ว');
          }}
          onManualSyncPush={handleManualSyncPush}
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

      {/* Clan Settings / Backup / Export Modal */}
      {showSettings && (
        <ClanSettingsModal
          data={data}
          canEdit={access.canEdit}
          onClose={() => setShowSettings(false)}
          onUpdateClanInfo={(clanName, motto) => {
            commitChange({
              ...data,
              clanName,
              motto,
              updatedAt: new Date().toISOString(),
            });
          }}
          onImportData={(imported) => {
            commitChange(imported);
            setSelectedPersonId(null);
            setFocusRootId(null);
            setCollapsedIds(new Set());
            setLineageAnchorId(null);
            setCustomHighlight(null);
            showToast(`นำเข้าข้อมูล "${imported.clanName}" เรียบร้อยแล้ว`);
            setTimeout(() => treeCanvasRef.current?.fitToScreen(), 120);
          }}
          onExportPng={() =>
            exportTreeAsPng(data, { compact, collapsedIds, focusRootId, palette })
          }
          onResetSample={() => {
            commitChange(createSampleFamilyTree());
            setSelectedPersonId(null);
            setFocusRootId(null);
            setCollapsedIds(new Set());
            setLineageAnchorId(null);
            setCustomHighlight(null);
            showToast('โหลดข้อมูลตัวอย่างเรียบร้อยแล้ว');
            setTimeout(() => treeCanvasRef.current?.fitToScreen(), 120);
          }}
          onStartFresh={(newClanName) => {
            const fresh = createEmptyFamilyTree(newClanName);
            commitChange(fresh);
            setSelectedPersonId(fresh.rootPersonId ?? null);
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
