import React, { useRef, useState } from 'react';
import {
  X,
  Palette,
  TreePine,
  Home,
  Sparkles,
  Grid,
  ImagePlus,
  RotateCcw,
  Check,
  Sliders,
} from 'lucide-react';
import { CanvasBackgroundType, ThemePresetId, ThemeSettings } from '../types/family';
import { THEME_PRESETS, ThemePalette } from '../utils/themes';
import { resizeGalleryImageFile } from '../utils/imageUtils';
import { uploadDataUrlToStorage } from '../lib/supabase';

interface ThemePickerModalProps {
  settings: ThemeSettings;
  palette: ThemePalette;
  onChange: (next: ThemeSettings) => void;
  onClose: () => void;
}

const BG_OPTIONS: Array<{
  id: CanvasBackgroundType;
  label: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'tree', label: 'ต้นไม้ใหญ่', desc: 'ต้นไม้ประจำตระกูล', icon: TreePine },
  { id: 'house', label: 'บ้านอบอุ่น', desc: 'เรือนครอบครัวในสวน', icon: Home },
  { id: 'botanical', label: 'สีน้ำพฤกษา', desc: 'ละมุนโปร่งสบาย', icon: Sparkles },
  { id: 'dots', label: 'ลายจุดเรียบ', desc: 'คลีน อ่านง่าย', icon: Grid },
  { id: 'custom', label: 'รูปภาพเอง', desc: 'อัปโหลดรูปบ้าน/ญาติ', icon: ImagePlus },
];

export const ThemePickerModal: React.FC<ThemePickerModalProps> = ({
  settings,
  palette,
  onChange,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadErr, setUploadErr] = useState('');

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr('');
    try {
      const dataUrl = await resizeGalleryImageFile(file, 1280, 0.78);
      const storedUrl = await uploadDataUrlToStorage(dataUrl, 'backgrounds');
      onChange({
        ...settings,
        bgType: 'custom',
        customBgImage: storedUrl,
        bgBlur: settings.bgBlur < 2 ? 3 : settings.bgBlur,
        bgOpacity: Math.min(settings.bgOpacity, 0.55),
      });
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : 'อัปโหลดรูปพื้นหลังไม่สำเร็จ');
    }
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-end p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: palette.bgSurface,
          borderColor: palette.border,
          color: palette.textMain,
        }}
        className="w-full max-w-md h-full max-h-[88vh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
          className="px-5 py-4 border-b flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{ backgroundColor: palette.primary }}
              className="w-8 h-8 rounded-xl text-white flex items-center justify-center"
            >
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold font-serif-thai">ตกแต่งธีมสี & พื้นหลัง</h2>
              <p style={{ color: palette.textMuted }} className="text-[11px]">
                เห็นผลทันทีแบบเรียลไทม์บนผังตระกูลด้านหลัง
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Preset Color Themes */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 style={{ color: palette.textMuted }} className="text-xs font-semibold uppercase tracking-wide">
                ชุดธีมสีสำเร็จรูป
              </h3>
              {(settings.customPrimary || settings.customAccent) && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...settings,
                      customPrimary: undefined,
                      customAccent: undefined,
                    })
                  }
                  style={{ color: palette.primary }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  คืนค่าสีมาตรฐาน
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(THEME_PRESETS) as ThemePresetId[]).map((id) => {
                const preset = THEME_PRESETS[id];
                const isSelected = settings.presetId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...settings,
                        presetId: id,
                        customPrimary: undefined,
                        customAccent: undefined,
                      })
                    }
                    style={{
                      backgroundColor: isSelected ? palette.primarySoft : palette.bgSurface,
                      borderColor: isSelected ? palette.primary : palette.border,
                    }}
                    className="w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center -space-x-1.5 shrink-0">
                        <span
                          className="w-6 h-6 rounded-full border-2 border-white shadow-xs"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="w-6 h-6 rounded-full border-2 border-white shadow-xs"
                          style={{ backgroundColor: preset.accent }}
                        />
                        <span
                          className="w-6 h-6 rounded-full border-2 border-white shadow-xs"
                          style={{ backgroundColor: preset.bgCanvas }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{preset.name}</div>
                        <div style={{ color: palette.textMuted }} className="text-[11px] truncate">
                          {preset.subtitle}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div
                        style={{ backgroundColor: palette.primary }}
                        className="w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0"
                      >
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Custom Color Pickers */}
          <div style={{ borderColor: palette.border }} className="pt-4 border-t space-y-3">
            <h3 style={{ color: palette.textMuted }} className="text-xs font-semibold uppercase tracking-wide">
              ปรับแต่งสีเองตามใจชอบ
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label
                style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border cursor-pointer"
              >
                <div>
                  <div className="text-xs font-medium">สีหลัก (Primary)</div>
                  <div style={{ color: palette.textMuted }} className="text-[10.5px] font-mono">
                    {palette.primary}
                  </div>
                </div>
                <input
                  type="color"
                  value={palette.primary}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      customPrimary: e.target.value,
                    })
                  }
                  className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                />
              </label>

              <label
                style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border cursor-pointer"
              >
                <div>
                  <div className="text-xs font-medium">สีรอง (Accent)</div>
                  <div style={{ color: palette.textMuted }} className="text-[10.5px] font-mono">
                    {palette.accent}
                  </div>
                </div>
                <input
                  type="color"
                  value={palette.accent}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      customAccent: e.target.value,
                    })
                  }
                  className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Section 3: Canvas Background Artwork / Custom Photo */}
          <div style={{ borderColor: palette.border }} className="pt-4 border-t space-y-3">
            <h3 style={{ color: palette.textMuted }} className="text-xs font-semibold uppercase tracking-wide">
              พื้นหลังผังตระกูล (Background)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BG_OPTIONS.map(({ id, label, desc, icon: Icon }) => {
                const active = settings.bgType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      if (id === 'custom' && !settings.customBgImage) {
                        fileInputRef.current?.click();
                      } else {
                        onChange({ ...settings, bgType: id });
                      }
                    }}
                    style={{
                      backgroundColor: active ? palette.primarySoft : palette.bgSubtle,
                      borderColor: active ? palette.primary : palette.border,
                    }}
                    className="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1"
                  >
                    <Icon
                      className="w-4 h-4"
                    />
                    <div className="text-xs font-semibold leading-tight mt-0.5">{label}</div>
                    <div style={{ color: palette.textMuted }} className="text-[10px] leading-tight">
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadBg}
              className="hidden"
            />

            {/* Upload or replace custom photo button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  borderColor: palette.primary,
                  color: palette.primary,
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed text-xs font-medium hover:opacity-85 transition-opacity cursor-pointer"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                {settings.customBgImage ? 'เปลี่ยนรูปพื้นหลังที่อัปโหลด' : 'อัปโหลดรูปบ้าน / สวน / รูปครอบครัว'}
              </button>
              {settings.customBgImage && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...settings,
                      customBgImage: undefined,
                      bgType: 'tree',
                    })
                  }
                  className="px-3 py-2 rounded-xl text-xs text-[#C24B38] hover:bg-[#C24B38]/10 cursor-pointer"
                >
                  ลบรูป
                </button>
              )}
            </div>
            {uploadErr && <p className="text-[11px] text-[#C24B38]">{uploadErr}</p>}

            {/* Live Blur & Opacity Sliders */}
            <div
              style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
              className="p-3.5 rounded-xl border space-y-3"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Sliders className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                ปรับลูกเล่นความเบลอ & ความเข้มพื้นหลัง
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: palette.textMuted }}>ความเบลอ (Blur)</span>
                  <span className="font-mono font-medium">{settings.bgBlur}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={18}
                  step={1}
                  value={settings.bgBlur}
                  onChange={(e) =>
                    onChange({ ...settings, bgBlur: Number(e.target.value) })
                  }
                  style={{ accentColor: palette.primary }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: palette.textMuted }}>ความชัดของพื้นหลัง (Opacity)</span>
                  <span className="font-mono font-medium">{Math.round(settings.bgOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={settings.bgOpacity}
                  onChange={(e) =>
                    onChange({ ...settings, bgOpacity: Number(e.target.value) })
                  }
                  style={{ accentColor: palette.primary }}
                  className="w-full cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
          className="px-5 py-3 border-t flex justify-end"
        >
          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: palette.primary }}
            className="px-5 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 cursor-pointer"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
};
