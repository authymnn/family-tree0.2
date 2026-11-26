import React from 'react';
import { ThemeSettings } from '../types/family';
import { ThemePalette } from '../utils/themes';

interface CanvasBackgroundProps {
  themeSettings: ThemeSettings;
  palette: ThemePalette;
}

/**
 * Renders atmospheric decorative backgrounds behind the interactive family tree canvas:
 * - Dot Grid
 * - Ancestral Banyan/Family Tree illustration
 * - Warm Thai/Modern Family Homestead illustration
 * - Botanical Leaves & Soft Watercolor Glow
 * - Custom User-Uploaded Photo
 * All supporting live blur & opacity controls so cards stay crisp and legible.
 */
export const CanvasBackground: React.FC<CanvasBackgroundProps> = ({
  themeSettings,
  palette,
}) => {
  const { bgType, customBgImage, bgBlur, bgOpacity } = themeSettings;

  const filterStyle: React.CSSProperties = {
    filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined,
    opacity: bgOpacity,
    transform: bgBlur > 0 ? 'scale(1.04)' : undefined, // Avoid blurry edge vignette
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ backgroundColor: palette.bgCanvas }}
    >
      {/* Subtle dot grid base when dots selected or underneath illustrations */}
      {bgType === 'dots' && (
        <div
          className="absolute inset-0 tree-canvas-dots"
          style={{ opacity: Math.max(0.35, bgOpacity) }}
        />
      )}

      {/* 1. Ancestral Tree Artwork */}
      {bgType === 'tree' && (
        <div className="absolute inset-0 transition-all duration-300" style={filterStyle}>
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMax slice"
            className="w-full h-full"
          >
            <defs>
              <radialGradient id="sunGlowTree" cx="50%" cy="28%" r="55%">
                <stop offset="0%" stopColor={palette.accent} stopOpacity="0.24" />
                <stop offset="60%" stopColor={palette.primary} stopOpacity="0.08" />
                <stop offset="100%" stopColor={palette.bgCanvas} stopOpacity="0" />
              </radialGradient>
              <linearGradient id="hillGradTree" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={palette.primary} stopOpacity="0.28" />
                <stop offset="100%" stopColor={palette.primary} stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {/* Warm sun halo */}
            <rect width="1440" height="900" fill="url(#sunGlowTree)" />

            {/* Soft distant rolling hills */}
            <path
              d="M0 760 Q360 680 720 740 T1440 720 L1440 900 L0 900 Z"
              fill={palette.primary}
              fillOpacity="0.1"
            />
            <path
              d="M0 820 Q420 755 820 805 T1440 785 L1440 900 L0 900 Z"
              fill="url(#hillGradTree)"
            />

            {/* Lush Layered Foliage Canopy */}
            <g fill={palette.primary}>
              <ellipse cx="720" cy="300" rx="430" ry="205" fillOpacity="0.11" />
              <ellipse cx="470" cy="340" rx="230" ry="145" fillOpacity="0.13" />
              <ellipse cx="970" cy="335" rx="240" ry="150" fillOpacity="0.13" />
              <ellipse cx="620" cy="240" rx="215" ry="135" fillOpacity="0.14" />
              <ellipse cx="835" cy="245" rx="210" ry="130" fillOpacity="0.14" />
              <ellipse cx="720" cy="185" rx="180" ry="105" fillOpacity="0.12" />
            </g>

            {/* Warm Golden Accent Leaf Clusters */}
            <g fill={palette.accent} fillOpacity="0.16">
              <circle cx="515" cy="260" r="68" />
              <circle cx="910" cy="275" r="76" />
              <circle cx="725" cy="200" r="62" />
              <circle cx="380" cy="370" r="46" />
              <circle cx="1065" cy="365" r="52" />
            </g>

            {/* Majestic Ancestral Trunk & Branches */}
            <path
              d="M665 860
                 C680 760, 692 670, 692 560
                 C688 490, 620 430, 495 375
                 C540 385, 625 418, 695 478
                 C692 405, 650 335, 585 268
                 C640 302, 688 355, 718 425
                 C735 352, 785 292, 855 245
                 C805 312, 765 375, 752 465
                 C822 415, 902 385, 965 365
                 C850 430, 775 490, 762 565
                 C762 670, 778 765, 805 860
                 C760 842, 710 842, 665 860 Z"
              fill={palette.accent}
              fillOpacity="0.28"
            />

            {/* Floating Falling Leaves */}
            <g fill={palette.accent} fillOpacity="0.32">
              <ellipse cx="310" cy="490" rx="8" ry="4" transform="rotate(-28 310 490)" />
              <ellipse cx="1140" cy="465" rx="9" ry="4.5" transform="rotate(24 1140 465)" />
              <ellipse cx="420" cy="610" rx="7" ry="3.5" transform="rotate(18 420 610)" />
              <ellipse cx="1020" cy="590" rx="7.5" ry="3.8" transform="rotate(-22 1020 590)" />
              <ellipse cx="565" cy="540" rx="6" ry="3" transform="rotate(35 565 540)" />
            </g>
          </svg>
        </div>
      )}

      {/* 2. Warm Family Home Artwork */}
      {bgType === 'house' && (
        <div className="absolute inset-0 transition-all duration-300" style={filterStyle}>
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMax slice"
            className="w-full h-full"
          >
            <defs>
              <linearGradient id="skyHouse" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={palette.accent} stopOpacity="0.16" />
                <stop offset="55%" stopColor={palette.primary} stopOpacity="0.06" />
                <stop offset="100%" stopColor={palette.bgCanvas} stopOpacity="0" />
              </linearGradient>
            </defs>

            <rect width="1440" height="900" fill="url(#skyHouse)" />

            {/* Soft sun & gentle clouds */}
            <circle cx="1110" cy="210" r="72" fill={palette.accent} fillOpacity="0.2" />
            <g fill={palette.bgSurface} fillOpacity={palette.isDark ? 0.08 : 0.65}>
              <ellipse cx="310" cy="190" rx="95" ry="26" />
              <ellipse cx="355" cy="178" rx="62" ry="24" />
              <ellipse cx="920" cy="155" rx="110" ry="28" />
              <ellipse cx="975" cy="144" rx="68" ry="24" />
            </g>

            {/* Distant Mountains */}
            <path
              d="M0 680 L280 510 L540 640 L860 470 L1180 620 L1440 520 L1440 900 L0 900 Z"
              fill={palette.primary}
              fillOpacity="0.09"
            />

            {/* Garden Lawn */}
            <path
              d="M0 740 Q520 675 960 725 T1440 705 L1440 900 L0 900 Z"
              fill={palette.primary}
              fillOpacity="0.18"
            />

            {/* Side Garden Trees */}
            <g fill={palette.primary} fillOpacity="0.26">
              <circle cx="385" cy="610" r="68" />
              <circle cx="435" cy="635" r="52" />
              <circle cx="1055" cy="605" r="74" />
              <circle cx="1005" cy="638" r="50" />
            </g>
            <g fill={palette.accent} fillOpacity="0.32">
              <rect x="379" y="655" width="14" height="80" rx="4" />
              <rect x="1048" y="655" width="14" height="82" rx="4" />
            </g>

            {/* Warm Ancestral Family House (Centered) */}
            <g transform="translate(500, 465)">
              {/* Main house wall */}
              <rect
                x="65"
                y="120"
                width="310"
                height="155"
                rx="8"
                fill={palette.bgSurface}
                fillOpacity={palette.isDark ? 0.35 : 0.85}
                stroke={palette.primary}
                strokeOpacity="0.3"
                strokeWidth="3"
              />
              {/* Second floor gable */}
              <polygon
                points="115,120 220,38 325,120"
                fill={palette.bgSurface}
                fillOpacity={palette.isDark ? 0.4 : 0.9}
              />
              {/* Pitched Thai-inspired layered roof */}
              <polygon
                points="28,128 220,16 412,128 386,138 220,42 54,138"
                fill={palette.accent}
                fillOpacity="0.58"
              />
              {/* Upper roof finial */}
              <polygon
                points="82,124 220,30 358,124"
                fill={palette.accent}
                fillOpacity="0.35"
              />
              {/* Warm glowing windows */}
              <rect x="102" y="156" width="52" height="54" rx="6" fill={palette.accent} fillOpacity="0.35" />
              <rect x="286" y="156" width="52" height="54" rx="6" fill={palette.accent} fillOpacity="0.35" />
              <circle cx="220" cy="88" r="18" fill={palette.accent} fillOpacity="0.38" />
              {/* Welcoming front door & porch */}
              <rect x="188" y="178" width="64" height="97" rx="8" fill={palette.primary} fillOpacity="0.4" />
              {/* Pathway */}
              <path
                d="M192 275 L248 275 L286 385 L154 385 Z"
                fill={palette.accent}
                fillOpacity="0.18"
              />
            </g>
          </svg>
        </div>
      )}

      {/* 3. Botanical Watercolor Aura */}
      {bgType === 'botanical' && (
        <div className="absolute inset-0 transition-all duration-300" style={filterStyle}>
          <svg
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full"
          >
            <defs>
              <radialGradient id="blob1" cx="20%" cy="22%" r="42%">
                <stop offset="0%" stopColor={palette.primary} stopOpacity="0.28" />
                <stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="blob2" cx="82%" cy="76%" r="46%">
                <stop offset="0%" stopColor={palette.accent} stopOpacity="0.26" />
                <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="blob3" cx="76%" cy="20%" r="32%">
                <stop offset="0%" stopColor={palette.primary} stopOpacity="0.18" />
                <stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="1440" height="900" fill="url(#blob1)" />
            <rect width="1440" height="900" fill="url(#blob2)" />
            <rect width="1440" height="900" fill="url(#blob3)" />

            {/* Delicate botanical sprigs on corners */}
            <g stroke={palette.primary} strokeWidth="2.5" fill="none" strokeOpacity="0.32">
              <path d="M-10 180 C120 140, 210 210, 310 120" />
              <path d="M1450 740 C1310 780, 1210 700, 1090 790" />
            </g>
            <g fill={palette.primary} fillOpacity="0.22">
              <ellipse cx="95" cy="145" rx="34" ry="14" transform="rotate(-24 95 145)" />
              <ellipse cx="180" cy="182" rx="30" ry="12" transform="rotate(18 180 182)" />
              <ellipse cx="255" cy="138" rx="26" ry="11" transform="rotate(-32 255 138)" />
              <ellipse cx="1320" cy="765" rx="36" ry="14" transform="rotate(-20 1320 765)" />
              <ellipse cx="1225" cy="730" rx="30" ry="12" transform="rotate(24 1225 730)" />
              <ellipse cx="1145" cy="774" rx="28" ry="11" transform="rotate(-18 1145 774)" />
            </g>
          </svg>
        </div>
      )}

      {/* 4. Custom Uploaded Image */}
      {bgType === 'custom' && customBgImage && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-200"
          style={{
            backgroundImage: `url(${customBgImage})`,
            ...filterStyle,
          }}
        />
      )}

      {/* Subtle dot grid overlay on top of custom/illustrated backgrounds at very low opacity for spatial feel */}
      {bgType !== 'dots' && (
        <div
          className="absolute inset-0 tree-canvas-dots"
          style={{ opacity: 0.25 }}
        />
      )}
    </div>
  );
};
