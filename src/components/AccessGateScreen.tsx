import React, { useState } from 'react';
import { Lock, ShieldCheck, TreePine, ArrowRight } from 'lucide-react';
import { ThemePalette } from '../utils/themes';

interface AccessGateScreenProps {
  clanName?: string;
  palette: ThemePalette;
  error?: string;
  loading?: boolean;
  onUnlock: (pin: string, asAdmin: boolean) => Promise<void> | void;
}

export const AccessGateScreen: React.FC<AccessGateScreenProps> = ({
  clanName,
  palette,
  error,
  loading = false,
  onUnlock,
}) => {
  const [pin, setPin] = useState('');
  const [asAdmin, setAsAdmin] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    onUnlock(pin.trim(), asAdmin);
  };

  return (
    <div
      style={{ backgroundColor: palette.bgApp, color: palette.textMain }}
      className="h-screen w-screen flex items-center justify-center p-4"
    >
      <div
        style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
        className="w-full max-w-md rounded-3xl border shadow-xl p-7 sm:p-8 space-y-6 animate-fade-in"
      >
        <div className="text-center space-y-2.5">
          <div
            style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          >
            <TreePine className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold font-serif-thai">
            {clanName || 'ผังตระกูลครอบครัว'}
          </h1>
          <p style={{ color: palette.textMuted }} className="text-xs leading-relaxed">
            แอดมินได้ล็อกการเข้าชมผังตระกูลนี้ไว้เพื่อความเป็นส่วนตัวของคนในครอบครัว
            <br />
            กรุณากรอกรหัสผ่านเพื่อเข้าชม
          </p>
        </div>

        {/* Mode toggle: Family View PIN vs Admin PIN */}
        <div
          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
          className="grid grid-cols-2 p-1 rounded-xl border"
        >
          <button
            type="button"
            onClick={() => setAsAdmin(false)}
            style={
              !asAdmin
                ? { backgroundColor: palette.bgSurface, color: palette.textMain }
                : { color: palette.textMuted }
            }
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            รหัสเข้าบ้าน (สมาชิก)
          </button>
          <button
            type="button"
            onClick={() => setAsAdmin(true)}
            style={
              asAdmin
                ? { backgroundColor: palette.bgSurface, color: palette.textMain }
                : { color: palette.textMuted }
            }
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            เข้าสู่ระบบแอดมิน
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label style={{ color: palette.textMuted }} className="block text-xs font-medium mb-1.5">
              {asAdmin ? 'รหัสผ่านแอดมิน (Admin PIN)' : 'รหัสผ่านครอบครัว (Family PIN)'}
            </label>
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={asAdmin ? 'กรอกรหัสแอดมิน...' : 'กรอกรหัสเข้าบ้าน...'}
              style={{
                backgroundColor: palette.bgSubtle,
                borderColor: palette.border,
                color: palette.textMain,
              }}
              className="w-full px-4 py-3 text-center text-lg tracking-[0.25em] rounded-xl border focus:outline-none"
            />
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#FCEEEB] border border-[#ECC5BC] text-[#9E3B28] text-xs text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !pin.trim()}
            style={{ backgroundColor: palette.primary }}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'ปลดล็อกเข้าสู่ผังตระกูล'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
