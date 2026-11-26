import { CardStyle, FamilyTreeData, TreeOrientation } from '../types/family';
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
 * Supports all card styles (detailed, compact, photo-only), orientations (top-down, bottom-up, left-right),
 * and respects the user's active color theme.
 */
export async function exportTreeAsPng(
  data: FamilyTreeData,
  options: {
    cardStyle?: CardStyle;
    compact?: boolean;
    orientation?: TreeOrientation;
    collapsedIds?: Set<string>;
    focusRootId?: string | null;
    palette?: ThemePalette;
  } = {}
): Promise<void> {
  const palette = options.palette ?? THEME_PRESETS.heirloom;
  const cardStyle: CardStyle = options.cardStyle ?? (options.compact ? 'compact' : 'detailed');
  const orientation: TreeOrientation = options.orientation ?? 'top-down';
  const layout = computeFamilyTreeLayout(data, {
    cardStyle,
    orientation,
    collapsedIds: options.collapsedIds,
    focusRootId: options.focusRootId,
  });

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

  // Header
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

  // Parent-child connectors
  ctx.strokeStyle = palette.connectorLine;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const conn of layout.parentChildConnectors) {
    const p2d = new Path2D(conn.path);
    ctx.stroke(p2d);
  }

  // Marriage connectors
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

  // Preload photos
  const loadedImages: Record<string, HTMLImageElement> = {};
  await Promise.all(
    layout.cards
      .filter((c) => c.person.photo)
      .map(
        (c) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              loadedImages[c.person.id] = img;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = c.person.photo!;
          })
      )
  );

  // Draw cards
  for (const card of layout.cards) {
    const { person, x, y, width, height } = card;
    const accent =
      person.gender === 'male'
        ? palette.primary
        : person.gender === 'female'
          ? palette.accent
          : palette.textMuted;

    // Card shadow + body
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    drawRoundedRect(ctx, x, y, width, height, 14);
    ctx.fillStyle = person.isDeceased ? palette.bgSubtle : palette.bgSurface;
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, x, y, width, height, 14);
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // Vertical Portrait Photo-Only Tile (for top-down & bottom-up)
    if (cardStyle === 'photo-only' && orientation !== 'left-right') {
      const avatarR = 26;
      const avatarCx = x + width / 2;
      const avatarCy = y + 38;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = person.gender === 'male' ? palette.primarySoft : palette.accentSoft;
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
        ctx.font = '700 15px "Noto Sans Thai", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = Array.from((person.nickname || person.firstName || '?').trim())
          .slice(0, 2)
          .join('');
        ctx.fillText(initials, avatarCx, avatarCy + 1);
      }
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = palette.textMain;
      ctx.font = '600 13px "Noto Sans Thai", sans-serif';
      ctx.fillText(truncateText(ctx, person.firstName, width - 14), x + width / 2, y + 86);

      if (person.nickname) {
        ctx.fillStyle = palette.accent;
        ctx.font = '500 11px "Noto Sans Thai", sans-serif';
        ctx.fillText(truncateText(ctx, `(${person.nickname})`, width - 14), x + width / 2, y + 104);
      }
      continue;
    }

    // Left accent strip
    ctx.save();
    drawRoundedRect(ctx, x, y, width, height, 14);
    ctx.clip();
    ctx.fillStyle = person.isDeceased ? palette.textMuted : accent;
    ctx.fillRect(x, y, 4.5, height);
    ctx.restore();

    const isMini = cardStyle === 'photo-only' || cardStyle === 'compact';
    const avatarR = cardStyle === 'photo-only' ? 16 : cardStyle === 'compact' ? 18 : 22;
    const avatarCx = x + 14 + avatarR;
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
      ctx.font = `600 ${isMini ? 12 : 14}px "Noto Sans Thai", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initials = Array.from((person.nickname || person.firstName || '?').trim())
        .slice(0, 2)
        .join('');
      ctx.fillText(initials, avatarCx, avatarCy + 1);
    }
    ctx.restore();

    const textX = avatarCx + avatarR + 10;
    const maxTextW = width - (textX - x) - 10;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (cardStyle === 'photo-only') {
      ctx.fillStyle = palette.textMain;
      ctx.font = '600 13px "Noto Sans Thai", sans-serif';
      ctx.fillText(truncateText(ctx, person.firstName, maxTextW), textX, y + 25);
      if (person.nickname || person.lastName) {
        ctx.fillStyle = person.nickname ? palette.accent : palette.textMuted;
        ctx.font = '500 11px "Noto Sans Thai", sans-serif';
        ctx.fillText(truncateText(ctx, person.nickname || person.lastName, maxTextW), textX, y + 41);
      }
      continue;
    }

    const displayName = `${person.title ? person.title + ' ' : ''}${person.firstName}`;
    ctx.fillStyle = palette.textMain;
    ctx.font = `600 ${cardStyle === 'compact' ? 12.5 : 14}px "Noto Sans Thai", sans-serif`;
    ctx.fillText(truncateText(ctx, displayName, maxTextW), textX, y + (cardStyle === 'compact' ? 28 : 34));

    if (person.lastName) {
      ctx.fillStyle = palette.textMuted;
      ctx.font = `400 ${cardStyle === 'compact' ? 11 : 12}px "Noto Sans Thai", sans-serif`;
      ctx.fillText(truncateText(ctx, person.lastName, maxTextW), textX, y + (cardStyle === 'compact' ? 44 : 52));
    }

    if (cardStyle === 'detailed') {
      const metaParts: string[] = [];
      if (person.nickname) metaParts.push(`"${person.nickname}"`);
      const age = calculateAge(person.birthDate, person.deathDate, person.isDeceased);
      const span = formatYearSpan(person.birthDate, person.deathDate, person.isDeceased);
      if (span) metaParts.push(span);
      else if (age != null) metaParts.push(`${age} ปี`);

      if (metaParts.length > 0) {
        ctx.fillStyle = palette.textMuted;
        ctx.font = '400 11px "Noto Sans Thai", sans-serif';
        ctx.fillText(truncateText(ctx, metaParts.join(' · '), maxTextW), textX, y + 73);
      }

      if (person.branch) {
        ctx.fillStyle = palette.accent;
        ctx.font = '500 10.5px "Noto Sans Thai", sans-serif';
        ctx.fillText(truncateText(ctx, person.branch, maxTextW), textX, y + 92);
      }
    }
  }

  ctx.restore();

  const link = document.createElement('a');
  const safeName = (data.clanName || 'family-tree').replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_');
  link.download = `${safeName}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
