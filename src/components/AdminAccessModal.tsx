import React, { useState } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  Eye,
  Edit3,
  KeyRound,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  Check,
  UploadCloud,
  MonitorSmartphone,
  Send,
} from 'lucide-react';
import { AccessState, CloudSyncStatus, EditAccessMode, ViewAccessMode } from '../types/access';
import { ThemePalette } from '../utils/themes';
import { FAMILY_TREE_ID, isSupabaseConfigured } from '../lib/supabase';

interface AdminAccessModalProps {
  access: AccessState;
  cloudStatus: CloudSyncStatus;
  lastSyncedAt?: string;
  palette: ThemePalette;
  currentDisplaySummary: string;
  onClose: () => void;
  onLoginAdmin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  onLogoutAdmin: () => void;
  onUnlockEditPin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  onSaveAccessRules: (rules: {
    viewMode: ViewAccessMode;
    editMode: EditAccessMode;
    newViewPin?: string;
    newEditPin?: string;
    newAdminPin?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onPushDisplayPresetToAll: () => Promise<{ ok: boolean; error?: string }>;
  onManualSyncPull: () => Promise<void>;
  onManualSyncPush: () => Promise<void>;
}

export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({
  access,
  cloudStatus,
  lastSyncedAt,
  palette,
  currentDisplaySummary,
  onClose,
  onLoginAdmin,
  onLogoutAdmin,
  onUnlockEditPin,
  onSaveAccessRules,
  onPushDisplayPresetToAll,
  onManualSyncPull,
  onManualSyncPush,
}) => {
  const [adminPinInput, setAdminPinInput] = useState('');
  const [editPinInput, setEditPinInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewAccessMode>(access.viewMode);
  const [editMode, setEditMode] = useState<EditAccessMode>(access.editMode);
  const [newViewPin, setNewViewPin] = useState('');
  const [newEditPin, setNewEditPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPinInput.trim()) return;
    setBusy(true);
    setErr('');
    setMsg('');
    const res = await onLoginAdmin(adminPinInput.trim());
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'รหัสผ่านแอดมินไม่ถูกต้อง');
    } else {
      setAdminPinInput('');
      setViewMode(access.viewMode);
      setEditMode(access.editMode);
      setMsg('ยืนยันสิทธิ์แอดมินเรียบร้อยแล้ว');
    }
  };

  const handleEditUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPinInput.trim()) return;
    setBusy(true);
    setErr('');
    setMsg('');
    const res = await onUnlockEditPin(editPinInput.trim());
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'รหัสผ่านแก้ไขไม่ถูกต้อง');
    } else {
      setEditPinInput('');
      setMsg('ปลดล็อกสิทธิ์แก้ไขเรียบร้อยแล้ว');
    }
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    const res = await onSaveAccessRules({
      viewMode,
      editMode,
      newViewPin: newViewPin.trim() || undefined,
      newEditPin: newEditPin.trim() || undefined,
      newAdminPin: newAdminPin.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || 'ไม่สามารถบันทึกการตั้งค่าได้');
    } else {
      setNewViewPin('');
      setNewEditPin('');
      setNewAdminPin('');
      setMsg('อัปเดตสิทธิ์การเข้าถึงเรียบร้อยแล้ว ทุกเครื่องจะได้รับสิทธิ์ใหม่ทันที');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: palette.bgSurface,
          borderColor: palette.border,
          color: palette.textMain,
        }}
        className="w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
          className="px-6 py-4 border-b flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{
                backgroundColor: access.isAdmin ? palette.primary : palette.accent,
              }}
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0"
            >
              {access.isAdmin ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold font-serif-thai">
                {access.isAdmin ? 'ตั้งค่าระบบแอดมิน & ฐานข้อมูล' : 'ยืนยันรหัสผ่านแอดมิน'}
              </h2>
              <p style={{ color: palette.textMuted }} className="text-[11px]">
                {access.isAdmin
                  ? 'ควบคุมการล็อก/ปลดล็อกสิทธิ์ดูและแก้ไขของทั้งตระกูล'
                  : 'กรุณากรอกรหัสผ่านก่อนเข้าดูหรือแก้ไขการตั้งค่าแอดมิน'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: palette.textMuted }}
            className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {msg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#E9F2EE] border border-[#C4DDD3] text-[#1D473B] text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              {msg}
            </div>
          )}
          {err && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FCEEEB] border border-[#ECC5BC] text-[#9E3B28] text-xs">
              {err}
            </div>
          )}

          {/* LOCKED GATE: Must enter Admin PIN before seeing ANY admin settings */}
          {!access.isAdmin ? (
            <div className="space-y-4">
              {/* If family edit requires an Edit PIN, let family members unlock editing here */}
              {access.editMode === 'pin' && !access.canEdit && (
                <form
                  onSubmit={handleEditUnlock}
                  style={{ borderColor: palette.accent, backgroundColor: palette.accentSoft }}
                  className="p-4 rounded-xl border space-y-2.5"
                >
                  <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: palette.accent }}>
                    <KeyRound className="w-3.5 h-3.5" />
                    ปลดล็อกสิทธิ์แก้ไขสำหรับสมาชิกครอบครัว
                  </div>
                  <p style={{ color: palette.textMuted }} className="text-[11px]">
                    กรอกรหัสผ่านแก้ไขของครอบครัวเพื่อเพิ่ม/แก้ไขข้อมูลสมาชิก (ไม่ต้องใช้รหัสแอดมิน)
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={editPinInput}
                      onChange={(e) => setEditPinInput(e.target.value)}
                      placeholder="กรอกรหัสผ่านแก้ไข..."
                      style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
                      className="flex-1 px-3 py-2 text-sm rounded-xl border focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy || !editPinInput.trim()}
                      style={{ backgroundColor: palette.accent }}
                      className="px-4 py-2 rounded-xl text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      ปลดล็อกแก้
                    </button>
                  </div>
                </form>
              )}

              <form
                onSubmit={handleAdminLogin}
                style={{ borderColor: palette.border, backgroundColor: palette.bgSubtle }}
                className="p-5 rounded-2xl border space-y-3.5"
              >
                <div className="flex items-start gap-3">
                  <div
                    style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">เข้าสู่หน้าตั้งค่าแอดมิน</div>
                    <p style={{ color: palette.textMuted }} className="text-xs mt-0.5 leading-relaxed">
                      ต้องยืนยันรหัสผ่านแอดมินก่อน จึงจะดูการตั้งค่าสิทธิ์ ล็อก/ปลดล็อกผัง เปลี่ยนรหัสผ่าน หรือสร้างตระกูลใหม่ได้
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <input
                    type="password"
                    autoFocus
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    placeholder="กรอกรหัสผ่านแอดมิน..."
                    style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
                    className="w-full px-4 py-2.5 text-center text-base tracking-[0.2em] rounded-xl border focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy || !adminPinInput.trim()}
                    style={{ backgroundColor: palette.primary }}
                    className="w-full py-2.5 rounded-xl text-white text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                  >
                    {busy ? 'กำลังตรวจสอบรหัสผ่าน...' : 'ปลดล็อกเข้าหน้าแอดมิน'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* UNLOCKED ADMIN CONTROL PANEL */
            <form onSubmit={handleSaveRules} className="space-y-5">
              {/* Top Admin Active Pill & Logout */}
              <div className="flex items-center justify-between">
                <span
                  style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  ยืนยันสิทธิ์แอดมินแล้ว
                </span>
                <button
                  type="button"
                  onClick={onLogoutAdmin}
                  className="inline-flex items-center gap-1 text-xs text-[#C24B38] hover:underline cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  ล็อกออกจากโหมดแอดมิน
                </button>
              </div>

              {/* Cloud Sync Control Banner (Visible to Admin only) */}
              <div
                style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  {isSupabaseConfigured ? (
                    <Cloud className="w-5 h-5 shrink-0" style={{ color: palette.primary }} />
                  ) : (
                    <CloudOff className="w-5 h-5 shrink-0" style={{ color: palette.accent }} />
                  )}
                  <div>
                    <div className="text-xs font-semibold">
                      {isSupabaseConfigured
                        ? cloudStatus === 'synced'
                          ? `เชื่อมต่อ Supabase Cloud แล้ว (ห้อง: ${FAMILY_TREE_ID})`
                          : cloudStatus === 'saving'
                            ? 'กำลังบันทึกขึ้น Supabase...'
                            : cloudStatus === 'connecting'
                              ? 'กำลังเชื่อมต่อ Supabase...'
                              : 'เชื่อมต่อ Supabase มีปัญหา'
                        : 'โหมดออฟไลน์ในเครื่อง'}
                    </div>
                    <div style={{ color: palette.textMuted }} className="text-[11px]">
                      {isSupabaseConfigured
                        ? lastSyncedAt
                          ? `ซิงก์ล่าสุด: ${new Date(lastSyncedAt).toLocaleTimeString('th-TH')}`
                          : 'ซิงก์ข้อมูลสมาชิกแบบเรียลไทม์ทุกเครื่อง'
                        : 'ยังไม่ได้ตั้งค่า Supabase ใน .env'}
                    </div>
                  </div>
                </div>

                {isSupabaseConfigured && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onManualSyncPull}
                      style={{ borderColor: palette.border, backgroundColor: palette.bgSurface }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium hover:opacity-85 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      ดึงล่าสุด
                    </button>
                    <button
                      type="button"
                      onClick={onManualSyncPush}
                      style={{ backgroundColor: palette.primary }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-[11px] font-medium hover:opacity-90 cursor-pointer"
                    >
                      <UploadCloud className="w-3 h-3" />
                      ส่งขึ้น Cloud
                    </button>
                  </div>
                )}
              </div>

              {/* 1. View Access Lock/Unlock */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold flex items-center gap-1.5">
                  <Eye className="w-4 h-4" style={{ color: palette.primary }} />
                  1. การเข้าชมผังตระกูล (ล็อก / ปลดล็อกการดู)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('public')}
                    style={{
                      backgroundColor: viewMode === 'public' ? palette.primarySoft : palette.bgSubtle,
                      borderColor: viewMode === 'public' ? palette.primary : palette.border,
                    }}
                    className="p-3 rounded-xl border text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Unlock className="w-3.5 h-3.5" />
                      เปิดให้ทุกคนดูได้
                    </div>
                    <p style={{ color: palette.textMuted }} className="text-[11px] mt-0.5">
                      ใครมีลิงก์เปิดดูผังได้ทันที ไม่ต้องใส่รหัส
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('pin')}
                    style={{
                      backgroundColor: viewMode === 'pin' ? palette.accentSoft : palette.bgSubtle,
                      borderColor: viewMode === 'pin' ? palette.accent : palette.border,
                    }}
                    className="p-3 rounded-xl border text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Lock className="w-3.5 h-3.5" />
                      ล็อกด้วยรหัสเข้าบ้าน
                    </div>
                    <p style={{ color: palette.textMuted }} className="text-[11px] mt-0.5">
                      ต้องกรอกรหัสครอบครัวก่อนถึงจะเห็นผัง
                    </p>
                  </button>
                </div>

                {viewMode === 'pin' && (
                  <input
                    type="text"
                    value={newViewPin}
                    onChange={(e) => setNewViewPin(e.target.value)}
                    placeholder="ตั้งรหัสเข้าบ้านใหม่ (เว้นว่างเพื่อใช้รหัสเดิม)"
                    style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none"
                  />
                )}
              </div>

              {/* 2. Edit Access Lock/Unlock */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4" style={{ color: palette.primary }} />
                  2. สิทธิ์การแก้ไขข้อมูล (ล็อก / ปลดล็อกการแก้ไข)
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      {
                        id: 'open',
                        title: 'ปลดล็อก — ให้ทุกคนในครอบครัวช่วยกันแก้ไขได้',
                        desc: 'ญาติทุกคนเพิ่มสมาชิก อัปโหลดรูป และแก้ไขข้อมูลได้ทันที',
                        icon: Unlock,
                      },
                      {
                        id: 'pin',
                        title: 'ต้องใส่รหัสแก้ไขก่อนจึงจะแก้ได้',
                        desc: 'ทุกคนดูได้ แต่คนที่จะช่วยอัปเดตข้อมูลต้องกรอกรหัสแก้ไขของครอบครัว',
                        icon: KeyRound,
                      },
                      {
                        id: 'locked',
                        title: 'ล็อกการแก้ไข — เฉพาะแอดมินเท่านั้นที่แก้ไขได้',
                        desc: 'ญาติทุกคนเข้าดูได้อย่างเดียว ป้องกันการเผลอกดลบหรือแก้พลาด',
                        icon: Lock,
                      },
                    ] as const
                  ).map(({ id, title, desc, icon: Icon }) => {
                    const active = editMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setEditMode(id)}
                        style={{
                          backgroundColor: active
                            ? id === 'locked'
                              ? palette.accentSoft
                              : palette.primarySoft
                            : palette.bgSubtle,
                          borderColor: active
                            ? id === 'locked'
                              ? palette.accent
                              : palette.primary
                            : palette.border,
                        }}
                        className="p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer"
                      >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">{title}</div>
                          <div style={{ color: palette.textMuted }} className="text-[11px] mt-0.5">
                            {desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {editMode === 'pin' && (
                  <input
                    type="text"
                    value={newEditPin}
                    onChange={(e) => setNewEditPin(e.target.value)}
                    placeholder="ตั้งรหัสแก้ไขใหม่ (เว้นว่างเพื่อใช้รหัสเดิม)"
                    style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none"
                  />
                )}
              </div>

              {/* 3. Broadcast Admin's Current Display Preset to All Family Devices */}
              <div
                style={{ backgroundColor: palette.primarySoft, borderColor: palette.primary }}
                className="p-4 rounded-xl border space-y-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <MonitorSmartphone className="w-4 h-4 mt-0.5 shrink-0" style={{ color: palette.primary }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold" style={{ color: palette.primary }}>
                      3. ส่งรูปแบบหน้าจอปัจจุบันให้ทุกคนดูตาม
                    </div>
                    <p style={{ color: palette.textMuted }} className="text-[11px] mt-0.5 leading-relaxed">
                      รูปแบบที่คุณกำลังดูอยู่ตอนนี้: <strong>{currentDisplaySummary}</strong>
                      <br />
                      กดปุ่มด้านล่างเพื่อส่งธีม พื้นหลัง รูปแบบการ์ด และทิศทางผังนี้ไปที่มือถือ/คอมของทุกคนทันที (หลังจากนั้นแต่ละคนยังปรับของตัวเองต่อได้)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setErr('');
                    setMsg('');
                    const res = await onPushDisplayPresetToAll();
                    setBusy(false);
                    if (!res.ok) {
                      setErr(res.error || 'ส่งรูปแบบการแสดงผลไม่สำเร็จ');
                    } else {
                      setMsg('ส่งรูปแบบการแสดงผลปัจจุบันให้ทุกเครื่องเรียบร้อยแล้ว!');
                    }
                  }}
                  style={{ backgroundColor: palette.primary }}
                  className="w-full py-2 rounded-xl text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  ส่งรูปแบบนี้ให้ทุกคนดูตามทันที
                </button>
              </div>

              {/* 4. Optional Change Admin PIN */}
              <div style={{ borderColor: palette.border }} className="pt-3 border-t space-y-1.5">
                <label className="block text-xs font-semibold">
                  เปลี่ยนรหัสผ่านแอดมิน (เว้นว่างถ้าไม่ต้องการเปลี่ยน)
                </label>
                <input
                  type="password"
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value)}
                  placeholder="กรอกรหัสผ่านแอดมินใหม่..."
                  style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  style={{ color: palette.textMuted }}
                  className="px-4 py-2 text-xs font-medium rounded-xl hover:bg-black/5 cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{ backgroundColor: palette.primary }}
                  className="px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าสิทธิ์'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
