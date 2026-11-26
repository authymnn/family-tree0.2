import { FamilyTreeData } from '../types/family';
import { computeFamilyTreeLayout } from './treeLayout';
import { calculateAge, formatYearSpan } from './dateUtils';
import { THEME_PRESETS, ThemePalette } from './themes';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(result + '…').width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + '…';
}

/**
 * Render the entire family tree directly onto a crisp 2x DPI HTML5 Canvas and download as PNG.
 * Works 100% offline with Thai fonts and respects the user's active color theme.
 */
export async function exportTreeAsPng(
  data: FamilyTreeData,
  options: {
    compact?: boolean;
    collapsedIds?: Set<string>;
    focusRootId?: string | null;
    palette?: ThemePalette;
  } = {}
): Promise<void> {
  const palette = options.palette ?? THEME_PRESETS.heirloom;
  const layout = computeFamilyTreeLayout(data, options);
  const headerHeight = 96;
  const scale = 2;
  const canvasW = layout.width;
  const canvasH = layout.height + headerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW * scale;
  canvas.height = canvasH * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.scale(scale, scale);

  // Theme background
  ctx.fillStyle = palette.bgCanvas;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Subtle decorative header
  ctx.fillStyle = palette.textMain;
  ctx.font = '700 28px "Noto Serif Thai", "Noto Sans Thai", serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.clanName || 'ผังตระกูล', canvasW / 2, 48);

  if (data.motto) {
    ctx.fillStyle = palette.textMuted;
    ctx.font = '400 14px "Noto Sans Thai", sans-serif';
    ctx.fillText(data.motto, canvasW / 2, 74);
  }

  ctx.save();
  ctx.translate(0, headerHeight);

  // Draw parent-child connectors
  ctx.strokeStyle = palette.connectorLine;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const conn of layout.parentChildConnectors) {
    const p2d = new Path2D(conn.path);
    ctx.stroke(p2d);
  }

  // Draw marriage connectors
  for (const mar of layout.marriageConnectors) {
    ctx.save();
    ctx.strokeStyle = mar.status === 'divorced' ? '#C2938B' : palette.accent;
    ctx.lineWidth = 2;
    if (mar.status === 'divorced') {
      ctx.setLineDash([4, 4]);
    }
    ctx.beginPath();
    ctx.moveTo(mar.x1, mar.y1);
    ctx.lineTo(mar.x2, mar.y2);
    ctx.stroke();
    ctx.restore();
  }

  // Preload photos for cards that have them
  const loadedImages: Record<string, HTMLImageElement> = {};
  await Promise.all(
    layout.cards
      .filter((c) => c.person.photo)
      .map(
        (c) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              loadedImages[c.person.id] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = c.person.photo!;
          })
      )
  );

  // Draw member cards
  ctx.textAlign = 'left';
  for (const card of layout.cards) {
    const { person, x, y, width, height } = card;
    const accent =
      person.gender === 'male'
        ? palette.primary
        : person.gender === 'female'
          ? palette.accent
          : palette.textMuted;

    // Card shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    drawRoundedRect(ctx, x, y, width, height, 14);
    ctx.fillStyle = person.isDeceased ? palette.bgSubtle : palette.bgSurface;
    ctx.fill();
    ctx.restore();

    // Card border
    drawRoundedRect(ctx, x, y, width, height, 14);
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // Left accent strip
    ctx.save();
    drawRoundedRect(ctx, x, y, width, height, 14);
    ctx.clip();
    ctx.fillStyle = person.isDeceased ? palette.textMuted : accent;
    ctx.fillRect(x, y, 4.5, height);
    ctx.restore();

    // Avatar circle
    const avatarR = options.compact ? 18 : 22;
    const avatarCx = x + 16 + avatarR;
    const avatarCy = y + height / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle =
      person.gender === 'male'
        ? palette.primarySoft
        : person.gender === 'female'
          ? palette.accentSoft
          : palette.bgSubtle;
    ctx.fill();
    ctx.clip();

    if (loadedImages[person.id]) {
      ctx.drawImage(
        loadedImages[person.id],
        avatarCx - avatarR,
        avatarCy - avatarR,
        avatarR * 2,
        avatarR * 2
      );
    } else {
      ctx.fillStyle = accent;
      ctx.font = `600 ${options.compact ? 12 : 14}px "Noto Sans Thai", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initials = Array.from((person.nickname || person.firstName || '?').trim()).slice(0, 2).join('');
      ctx.fillText(initials, avatarCx, avatarCy + 1);
    }
    ctx.restore();

    // Text content
    const textX = avatarCx + avatarR + 11;
    const maxTextW = width - (textX - x) - 12;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const displayName = `${person.title ? person.title + ' ' : ''}${person.firstName}`;
    ctx.fillStyle = palette.textMain;
    ctx.font = `600 ${options.compact ? 12.5 : 14}px "Noto Sans Thai", sans-serif`;
    ctx.fillText(truncateText(ctx, displayName, maxTextW), textX, y + (options.compact ? 29 : 34));

    if (person.lastName) {
      ctx.fillStyle = palette.textMuted;
      ctx.font = `400 ${options.compact ? 11 : 12}px "Noto Sans Thai", sans-serif`;
      ctx.fillText(truncateText(ctx, person.lastName, maxTextW), textX, y + (options.compact ? 45 : 52));
    }

    const metaParts: string[] = [];
    if (person.nickname) metaParts.push(`"${person.nickname}"`);
    const age = calculateAge(person.birthDate, person.deathDate, person.isDeceased);
    const span = formatYearSpan(person.birthDate, person.deathDate, person.isDeceased);
    if (span) metaParts.push(span);
    else if (age != null) metaParts.push(`${age} ปี`);

    if (metaParts.length > 0 && !options.compact) {
      ctx.fillStyle = palette.textMuted;
      ctx.font = '400 11px "Noto Sans Thai", sans-serif';
      ctx.fillText(truncateText(ctx, metaParts.join(' · '), maxTextW), textX, y + 73);
    }

    if (person.branch && !options.compact) {
      ctx.fillStyle = palette.accent;
      ctx.font = '500 10.5px "Noto Sans Thai", sans-serif';
      ctx.fillText(truncateText(ctx, person.branch, maxTextW), textX, y + 92);
    }
  }

  ctx.restore();

  // Trigger download
  const link = document.createElement('a');
  const safeName = (data.clanName || 'family-tree').replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_');
  link.download = `${safeName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
