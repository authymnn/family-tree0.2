import { CanvasBackgroundType, ThemePresetId, ThemeSettings } from '../types/family';

export interface ThemePalette {
  id: ThemePresetId;
  name: string;
  subtitle: string;
  isDark: boolean;
  primary: string;
  primaryHover: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  bgApp: string;
  bgCanvas: string;
  canvasDot: string;
  bgSurface: string;
  bgSubtle: string;
  border: string;
  textMain: string;
  textMuted: string;
  connectorLine: string;
}

export const THEME_PRESETS: Record<ThemePresetId, ThemePalette> = {
  heirloom: {
    id: 'heirloom',
    name: 'มรดกพฤกษา',
    subtitle: 'เขียวป่า & กระดาษอบอุ่น (ค่าเริ่มต้น)',
    isDark: false,
    primary: '#2E6254',
    primaryHover: '#234E42',
    primarySoft: '#E3EFEA',
    accent: '#B5653B',
    accentSoft: '#F8E7DE',
    bgApp: '#FAF8F4',
    bgCanvas: '#F6F3EC',
    canvasDot: '#D8D1C5',
    bgSurface: '#FFFFFF',
    bgSubtle: '#F4F0E8',
    border: '#E5DFD5',
    textMain: '#1C2B26',
    textMuted: '#64716C',
    connectorLine: '#7E7466',
  },
  indigo: {
    id: 'indigo',
    name: 'ครามสุโขทัย',
    subtitle: 'น้ำเงินคราม & ทองอำพัน สง่างาม',
    isDark: false,
    primary: '#274C77',
    primaryHover: '#1D3A5C',
    primarySoft: '#E4EEF8',
    accent: '#C47D2C',
    accentSoft: '#FBF0DF',
    bgApp: '#F8FAFC',
    bgCanvas: '#F1F5F9',
    canvasDot: '#CBD5E1',
    bgSurface: '#FFFFFF',
    bgSubtle: '#EDF2F7',
    border: '#DCE4EE',
    textMain: '#172536',
    textMuted: '#5B6B7C',
    connectorLine: '#637B96',
  },
  crimson: {
    id: 'crimson',
    name: 'ทับทิมสยาม',
    subtitle: 'แดงไวน์มงคล & โรสโกลด์',
    isDark: false,
    primary: '#8E354A',
    primaryHover: '#702638',
    primarySoft: '#F8E7EB',
    accent: '#C27D38',
    accentSoft: '#FAF0E2',
    bgApp: '#FCF9F7',
    bgCanvas: '#F8F2EF',
    canvasDot: '#E2D0CA',
    bgSurface: '#FFFFFF',
    bgSubtle: '#F5ECE8',
    border: '#EADCD6',
    textMain: '#2E1A1F',
    textMuted: '#786066',
    connectorLine: '#94746C',
  },
  celadon: {
    id: 'celadon',
    name: 'ศิลาดลสบายตา',
    subtitle: 'เขียวอมฟ้าละมุน อ่านง่ายสบายตา',
    isDark: false,
    primary: '#2B7A78',
    primaryHover: '#205E5C',
    primarySoft: '#E1F2F1',
    accent: '#C77A4B',
    accentSoft: '#F9EAE0',
    bgApp: '#F5FAF9',
    bgCanvas: '#EDF5F4',
    canvasDot: '#C5D8D6',
    bgSurface: '#FFFFFF',
    bgSubtle: '#E6F0EE',
    border: '#D5E4E2',
    textMain: '#172D2C',
    textMuted: '#5A7270',
    connectorLine: '#608884',
  },
  midnight: {
    id: 'midnight',
    name: 'ราตรีทอง (Dark)',
    subtitle: 'โหมดมืดถนอมสายตา & ทองแชมเปญ',
    isDark: true,
    primary: '#4EA88C',
    primaryHover: '#3E8F76',
    primarySoft: '#1D3831',
    accent: '#D99B52',
    accentSoft: '#3B2D1C',
    bgApp: '#131917',
    bgCanvas: '#18201E',
    canvasDot: '#2C3834',
    bgSurface: '#1F2926',
    bgSubtle: '#26332F',
    border: '#32423D',
    textMain: '#F1F5F3',
    textMuted: '#9FB0A9',
    connectorLine: '#7E9990',
  },
};

const THEME_STORAGE_KEY = 'thai_family_tree_theme_v1';

const VALID_BG_TYPES: CanvasBackgroundType[] = ['dots', 'tree', 'house', 'botanical', 'custom'];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function darkenHex(hex: string, amount = 0.16): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = 1 - amount;
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r * f)}${toHex(rgb.g * f)}${toHex(rgb.b * f)}`;
}

function softTintHex(hex: string, isDark: boolean): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return isDark ? '#24302C' : '#EAF0EE';
  const base = isDark ? { r: 24, g: 32, b: 30 } : { r: 255, g: 255, b: 255 };
  const alpha = isDark ? 0.24 : 0.14;
  const mix = (c: number, b: number) => Math.round(c * alpha + b * (1 - alpha));
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(mix(rgb.r, base.r))}${toHex(mix(rgb.g, base.g))}${toHex(mix(rgb.b, base.b))}`;
}

export function resolveTheme(settings: ThemeSettings): ThemePalette {
  const base = THEME_PRESETS[settings.presetId] ?? THEME_PRESETS.heirloom;
  const primary = settings.customPrimary || base.primary;
  const accent = settings.customAccent || base.accent;
  return {
    ...base,
    primary,
    primaryHover: settings.customPrimary ? darkenHex(primary, 0.16) : base.primaryHover,
    primarySoft: settings.customPrimary ? softTintHex(primary, base.isDark) : base.primarySoft,
    accent,
    accentSoft: settings.customAccent ? softTintHex(accent, base.isDark) : base.accentSoft,
  };
}

export function applyThemeToDocument(palette: ThemePalette): void {
  const root = document.documentElement;
  root.style.setProperty('--theme-primary', palette.primary);
  root.style.setProperty('--theme-primary-hover', palette.primaryHover);
  root.style.setProperty('--theme-primary-soft', palette.primarySoft);
  root.style.setProperty('--theme-accent', palette.accent);
  root.style.setProperty('--theme-accent-soft', palette.accentSoft);
  root.style.setProperty('--theme-bg-app', palette.bgApp);
  root.style.setProperty('--theme-bg-canvas', palette.bgCanvas);
  root.style.setProperty('--theme-canvas-dot', palette.canvasDot);
  root.style.setProperty('--theme-bg-surface', palette.bgSurface);
  root.style.setProperty('--theme-bg-subtle', palette.bgSubtle);
  root.style.setProperty('--theme-border', palette.border);
  root.style.setProperty('--theme-text-main', palette.textMain);
  root.style.setProperty('--theme-text-muted', palette.textMuted);
  root.style.setProperty('--theme-connector', palette.connectorLine);
  root.dataset.themeMode = palette.isDark ? 'dark' : 'light';
}

export function loadSavedTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
      if (parsed.presetId && parsed.presetId in THEME_PRESETS) {
        return {
          presetId: parsed.presetId,
          customPrimary: parsed.customPrimary,
          customAccent: parsed.customAccent,
          bgType:
            parsed.bgType && VALID_BG_TYPES.includes(parsed.bgType)
              ? parsed.bgType
              : 'tree',
          customBgImage: parsed.customBgImage,
          bgBlur: typeof parsed.bgBlur === 'number' ? parsed.bgBlur : 1,
          bgOpacity: typeof parsed.bgOpacity === 'number' ? parsed.bgOpacity : 0.48,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    presetId: 'heirloom',
    bgType: 'tree',
    bgBlur: 1,
    bgOpacity: 0.48,
  };
}

export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
