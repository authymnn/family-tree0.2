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
} from 'lucide-react';
import { AccessState, CloudSyncStatus, EditAccessMode, ViewAccessMode } from '../types/access';
import { ThemePalette } from '../utils/themes';
import { FAMILY_TREE_ID, isSupabaseConfigured } from '../lib/supabase';

interface AdminAccessModalProps {
  access: AccessState;
  cloudStatus: CloudSyncStatus;
  lastSyncedAt?: string;
  palette: ThemePalette;
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
  onManualSyncPull: () => Promise<void>;
  onManualSyncPush: () => Promise<void>;
}

export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({
  access,
  cloudStatus,
  lastSyncedAt,
  palette,
  onClose,
  onLoginAdmin,
  onLogoutAdmin,
  onUnlockEditPin,
  onSaveAccessRules,
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
      setMsg('เข้าสู่โหมดแอดมินเรียบร้อยแล้ว สามารถล็อกหรือปลดล็อกสิทธิ์ได้ทันที');
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
              {access.isAdmin ? <ShieldCheck className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold font-serif-thai">
                ระบบแอดมิน & ซิงก์ฐานข้อมูล Supabase
              </h2>
              <p style={{ color: palette.textMuted }} className="text-[11px]">
                ควบคุมการล็อก/ปลดล็อกสิทธิ์ดูและแก้ไขของคนในครอบครัว
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
          {/* Cloud Status Banner */}
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
                          : 'เชื่อมต่อ Supabase มีปัญหา (ตรวจสอบ .env / SQL)'
                    : 'โหมดออฟไลน์ในเครื่อง (ยังไม่ได้ใส่ค่า Supabase ใน .env)'}
                </div>
                <div style={{ color: palette.textMuted }} className="text-[11px]">
                  {isSupabaseConfigured
                    ? lastSyncedAt
                      ? `ซิงก์ล่าสุด: ${new Date(lastSyncedAt).toLocaleTimeString('th-TH')}`
                      : 'ซิงก์แบบเรียลไทม์อัตโนมัติทุกเครื่อง'
                    : 'ทดสอบล็อก/ปลดล็อกแอดมินได้เลย และเชื่อมต่อ Supabase ได้ทุกเมื่อ'}
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
                  title="ดึงข้อมูลล่าสุดจาก Supabase"
                >
                  <RefreshCw className="w-3 h-3" />
                  ดึงล่าสุด
                </button>
                {access.canEdit && (
                  <button
                    type="button"
                    onClick={onManualSyncPush}
                    style={{ backgroundColor: palette.primary }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-[11px] font-medium hover:opacity-90 cursor-pointer"
                    title="ส่งข้อมูลปัจจุบันขึ้น Supabase ทันที"
                  >
                    <UploadCloud className="w-3 h-3" />
                    ส่งขึ้น Cloud
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Current Permission Summary */}
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div
              style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
              className="p-3 rounded-xl border"
            >
              <div style={{ color: palette.textMuted }} className="text-[11px] flex items-center gap-1 mb-1">
                <Eye className="w-3 h-3" /> สิทธิ์การเข้าชม
              </div>
              <div className="font-semibold">
                {access.viewMode === 'public' ? 'เปิดให้ทุกคนที่มีลิงก์ดูได้' : 'ล็อกด้วยรหัสเข้าบ้าน'}
              </div>
            </div>
            <div
              style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
              className="p-3 rounded-xl border"
            >
              <div style={{ color: palette.textMuted }} className="text-[11px] flex items-center gap-1 mb-1">
                <Edit3 className="w-3 h-3" /> สิทธิ์การแก้ไข
              </div>
              <div className="font-semibold">
                {access.editMode === 'open'
                  ? 'เปิดให้ทุกคนช่วยกันแก้'
                  : access.editMode === 'pin'
                    ? 'ต้องใส่รหัสแก้ไข'
                    : 'ล็อก (เฉพาะแอดมิน)'}
              </div>
            </div>
          </div>

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

          {/* If NOT Admin: Unlock Edit PIN (when editMode === 'pin') + Admin Login */}
          {!access.isAdmin ? (
            <div className="space-y-4">
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
                      disabled={busy}
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
                className="p-4 rounded-xl border space-y-3"
              >
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Shield className="w-4 h-4" style={{ color: palette.primary }} />
                    เข้าสู่ระบบแอดมิน (สำหรับผู้ดูแลผังตระกูล)
                  </div>
                  <p style={{ color: palette.textMuted }} className="text-[11px] mt-0.5">
                    รหัสแอดมินเริ่มต้นคือ <code className="font-mono font-bold">1234</code> (แนะนำให้เปลี่ยนทันทีหลังเข้าสู่ระบบ)
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    placeholder="กรอกรหัสผ่านแอดมิน..."
                    style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    style={{ backgroundColor: palette.primary }}
                    className="px-4 py-2 rounded-xl text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    เข้าสู่ระบบ
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ADMIN CONTROL PANEL */
            <form onSubmit={handleSaveRules} className="space-y-5">
              <div className="flex items-center justify-between">
                <span
                  style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  คุณกำลังใช้งานในสิทธิ์แอดมิน
                </span>
                <button
                  type="button"
                  onClick={onLogoutAdmin}
                  className="inline-flex items-center gap-1 text-xs text-[#C24B38] hover:underline cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  ออกจากโหมดแอดมิน
                </button>
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
                    placeholder="ตั้งรหัสเข้าบ้านใหม่ (เว้นว่างเพื่อใช้รหัสเดิม ค่าเริ่มต้น 0000)"
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
                    placeholder="ตั้งรหัสแก้ไขใหม่ (เว้นว่างเพื่อใช้รหัสเดิม ค่าเริ่มต้น 8888)"
                    style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none"
                  />
                )}
              </div>

              {/* 3. Optional Change Admin PIN */}
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
