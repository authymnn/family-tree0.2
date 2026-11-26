import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  Heart,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Plus,
  RotateCcw,
  Sparkles,
  Users,
  Expand,
  Shrink,
  X,
  StickyNote,
  Images,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Map as MapIcon,
  LayoutGrid,
  UserCircle2,
  List,
} from 'lucide-react';
import {
  CardStyle,
  FamilyTreeData,
  QuickAddRelation,
  ThemeSettings,
  TreeOrientation,
} from '../types/family';
import { ThemePalette } from '../utils/themes';
import { computeFamilyTreeLayout, PositionedCard } from '../utils/treeLayout';
import { calculateAge, formatYearSpan } from '../utils/dateUtils';
import { getSiblingRankInfo } from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';
import { CanvasBackground } from './CanvasBackground';

export interface TreeCanvasHandle {
  focusPerson: (personId: string) => void;
  fitToScreen: () => void;
}

interface TreeCanvasProps {
  data: FamilyTreeData;
  selectedPersonId: string | null;
  highlightIds: Set<string> | null;
  highlightLabel?: string | null;
  onClearHighlight?: () => void;
  focusRootId: string | null;
  onClearFocusRoot: () => void;
  cardStyle: CardStyle;
  onChangeCardStyle: (style: CardStyle) => void;
  orientation: TreeOrientation;
  onChangeOrientation: (orientation: TreeOrientation) => void;
  collapsedIds: Set<string>;
  onToggleCollapse: (personId: string) => void;
  onExpandAll: () => void;
  onCollapseToLevel2: () => void;
  onSelectPerson: (personId: string) => void;
  onOpenCoupleDetail?: (personAId: string, personBId: string) => void;
  onQuickAdd: (anchorId: string, relation: QuickAddRelation) => void;
  onAddStandalone: () => void;
  branches: string[];
  themeSettings: ThemeSettings;
  palette: ThemePalette;
  readOnly?: boolean;
}

const CARD_STYLE_OPTIONS: Array<{
  id: CardStyle;
  label: string;
  title: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'detailed', label: 'ละเอียด', title: 'การ์ดเต็ม แสดงรายละเอียดครบ', icon: LayoutGrid },
  { id: 'compact', label: 'กะทัดรัด', title: 'การ์ดขนาดกลาง ประหยัดพื้นที่', icon: List },
  { id: 'photo-only', label: 'รูป+ชื่อ', title: 'เห็นรูปและชื่อใหญ่ชัดเจน เหมาะกับตระกูลใหญ่', icon: UserCircle2 },
];

const ORIENTATION_OPTIONS: Array<{
  id: TreeOrientation;
  label: string;
  title: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'top-down', label: 'บน→ล่าง', title: 'บรรพบุรุษด้านบน ลูกหลานด้านล่าง', icon: ArrowDown },
  { id: 'bottom-up', label: 'ล่าง→บน', title: 'บรรพบุรุษโคนต้นด้านล่าง แตกยอดขึ้นบน', icon: ArrowUp },
  { id: 'left-right', label: 'แนวตั้ง', title: 'รุ่นเรียงซ้ายไปขวา พี่น้องเรียงลงแนวตั้ง อ่านง่ายมากเมื่อมีลูกหลายคน!', icon: ArrowRight },
];

export const TreeCanvas = React.forwardRef<TreeCanvasHandle, TreeCanvasProps>(
  (
    {
      data,
      selectedPersonId,
      highlightIds,
      highlightLabel,
      onClearHighlight,
      focusRootId,
      onClearFocusRoot,
      cardStyle,
      onChangeCardStyle,
      orientation,
      onChangeOrientation,
      collapsedIds,
      onToggleCollapse,
      onExpandAll,
      onCollapseToLevel2,
      onSelectPerson,
      onOpenCoupleDetail,
      onQuickAdd,
      onAddStandalone,
      branches,
      themeSettings,
      palette,
      readOnly = false,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState({ x: 40, y: 30, scale: 0.92 });
    const [viewportSize, setViewportSize] = useState({ width: 1000, height: 650 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
    const didDragRef = useRef(false);
    const [branchFilter, setBranchFilter] = useState<string>('ALL');
    const [hasInitialFit, setHasInitialFit] = useState(false);
    const [showMinimap, setShowMinimap] = useState(true);

    const layout = useMemo(
      () =>
        computeFamilyTreeLayout(data, {
          cardStyle,
          orientation,
          collapsedIds,
          focusRootId,
        }),
      [data, cardStyle, orientation, collapsedIds, focusRootId]
    );

    // Track viewport container dimensions for minimap accuracy
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const updateSize = () => {
        const r = el.getBoundingClientRect();
        setViewportSize({ width: r.width, height: r.height });
      };
      updateSize();
      const ro = new ResizeObserver(updateSize);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const fitToScreen = useCallback(() => {
      const container = containerRef.current;
      if (!container || layout.cards.length === 0) return;
      const rect = container.getBoundingClientRect();
      const pad = 48;
      const scaleX = (rect.width - pad * 2) / layout.width;
      const scaleY = (rect.height - pad * 2) / layout.height;
      const nextScale = Math.max(0.24, Math.min(1.08, Math.min(scaleX, scaleY)));
      const x = (rect.width - layout.width * nextScale) / 2;
      const y = Math.max(32, (rect.height - layout.height * nextScale) / 2);
      setTransform({ x, y, scale: nextScale });
    }, [layout.width, layout.height, layout.cards.length]);

    const focusPerson = useCallback(
      (personId: string) => {
        const container = containerRef.current;
        const card = layout.cards.find((c) => c.person.id === personId);
        if (!container || !card) return;
        const rect = container.getBoundingClientRect();
        const targetScale = Math.max(transform.scale, 0.95);
        const cx = card.x + card.width / 2;
        const cy = card.y + card.height / 2;
        const centerOffsetX = !readOnly && rect.width > 960 ? -130 : 0;
        setTransform({
          x: rect.width / 2 + centerOffsetX - cx * targetScale,
          y: rect.height / 2 - cy * targetScale,
          scale: targetScale,
        });
      },
      [layout.cards, transform.scale, readOnly]
    );

    useImperativeHandle(ref, () => ({ focusPerson, fitToScreen }), [focusPerson, fitToScreen]);

    useEffect(() => {
      if (!hasInitialFit && layout.cards.length > 0) {
        const timer = setTimeout(() => {
          fitToScreen();
          setHasInitialFit(true);
        }, 40);
        return () => clearTimeout(timer);
      }
    }, [hasInitialFit, layout.cards.length, fitToScreen]);

    // Auto fit smoothly whenever orientation, cardStyle, or focusRoot changes
    useEffect(() => {
      const timer = setTimeout(() => fitToScreen(), 45);
      return () => clearTimeout(timer);
    }, [focusRootId, orientation, cardStyle, fitToScreen]);

    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setTransform((prev) => {
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.9;
        const nextScale = Math.max(0.18, Math.min(2.4, prev.scale * zoomFactor));
        const ratio = nextScale / prev.scale;
        return {
          scale: nextScale,
          x: mouseX - (mouseX - prev.x) * ratio,
          y: mouseY - (mouseY - prev.y) * ratio,
        };
      });
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-card-interactive="true"]')) return;
      if (e.button !== 0) return;
      setIsPanning(true);
      didDragRef.current = false;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        didDragRef.current = true;
      }
      setTransform((prev) => ({
        ...prev,
        x: panStartRef.current.tx + dx,
        y: panStartRef.current.ty + dy,
      }));
    };

    const handlePointerUp = () => {
      setIsPanning(false);
    };

    const zoomBy = (factor: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      setTransform((prev) => {
        const nextScale = Math.max(0.18, Math.min(2.4, prev.scale * factor));
        const ratio = nextScale / prev.scale;
        return {
          scale: nextScale,
          x: cx - (cx - prev.x) * ratio,
          y: cy - (cy - prev.y) * ratio,
        };
      });
    };

    // Minimap click-to-jump handler
    const MINIMAP_W = 168;
    const MINIMAP_H = 104;
    const miniScale = Math.min(
      (MINIMAP_W - 12) / Math.max(1, layout.width),
      (MINIMAP_H - 12) / Math.max(1, layout.height)
    );
    const miniOffsetX = (MINIMAP_W - layout.width * miniScale) / 2;
    const miniOffsetY = (MINIMAP_H - layout.height * miniScale) / 2;

    const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const worldX = (clickX - miniOffsetX) / miniScale;
      const worldY = (clickY - miniOffsetY) / miniScale;
      setTransform((prev) => ({
        ...prev,
        x: viewportSize.width / 2 - worldX * prev.scale,
        y: viewportSize.height / 2 - worldY * prev.scale,
      }));
    };

    const isCardDimmed = (card: PositionedCard): boolean => {
      if (highlightIds && highlightIds.size > 0) {
        return !highlightIds.has(card.person.id);
      }
      if (branchFilter !== 'ALL') {
        return (card.person.branch || 'ไม่ระบุสาย') !== branchFilter;
      }
      return false;
    };

    const focusRootPerson = focusRootId ? data.members[focusRootId] : null;
    const floatingBarBg = palette.isDark ? 'rgba(31,41,38,0.94)' : 'rgba(255,255,255,0.94)';

    if (Object.keys(data.members).length === 0) {
      return (
        <div className="relative flex-1 flex flex-col items-center justify-center p-8 text-center overflow-hidden">
          <CanvasBackground themeSettings={themeSettings} palette={palette} />
          <div className="relative z-10 flex flex-col items-center">
            <div
              style={{ backgroundColor: palette.bgSurface, borderColor: palette.border, color: palette.primary }}
              className="w-16 h-16 rounded-2xl border shadow-sm flex items-center justify-center mb-4"
            >
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold font-serif-thai">ยังไม่มีข้อมูลสมาชิกในตระกูลนี้</h3>
            <p className="text-sm theme-muted-text mt-1 max-w-sm">
              เริ่มต้นด้วยการเพิ่มสมาชิกคนแรก (เช่น บรรพบุรุษหรือตัวคุณเอง) แล้วค่อยๆ ขยายกิ่งก้านครอบครัว
            </p>
            {!readOnly && (
              <button
                onClick={onAddStandalone}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl theme-primary-btn text-sm font-medium shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                เพิ่มสมาชิกคนแรก
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="relative flex-1 overflow-hidden select-none">
        {/* Atmospheric Decorative / Custom Image Background */}
        <CanvasBackground themeSettings={themeSettings} palette={palette} />

        {/* Top-left floating bar: Branch Filter + Active Focus/Highlight Banners */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 max-w-[calc(100%-32px)] pointer-events-none">
          {branches.length > 1 && (
            <div
              style={{ backgroundColor: floatingBarBg, borderColor: palette.border }}
              className="pointer-events-auto flex items-center gap-1 backdrop-blur-md px-2 py-1.5 rounded-xl border shadow-sm overflow-x-auto max-w-full"
            >
              <GitBranch className="w-3.5 h-3.5 theme-muted-text ml-1 shrink-0" />
              <button
                onClick={() => setBranchFilter('ALL')}
                style={
                  branchFilter === 'ALL'
                    ? { backgroundColor: palette.primary, color: '#fff' }
                    : { color: palette.textMuted }
                }
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer"
              >
                ทุกสาย ({Object.keys(data.members).length})
              </button>
              {branches.map((b) => (
                <button
                  key={b}
                  onClick={() => setBranchFilter(b)}
                  style={
                    branchFilter === b
                      ? { backgroundColor: palette.accent, color: '#fff' }
                      : { color: palette.textMuted }
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer"
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {focusRootPerson && (
            <div
              style={{ backgroundColor: palette.primary }}
              className="pointer-events-auto flex items-center gap-2 text-white px-3 py-1.5 rounded-xl shadow-md text-xs"
            >
              <span>
                กำลังโฟกัสสายของ <strong>{focusRootPerson.firstName}</strong>
              </span>
              <button
                onClick={onClearFocusRoot}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                ดูทั้งตระกูล
              </button>
            </div>
          )}

          {highlightIds && highlightIds.size > 0 && (
            <div
              style={{ backgroundColor: palette.accent }}
              className="pointer-events-auto flex items-center gap-2 text-white px-3 py-1.5 rounded-xl shadow-md text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{highlightLabel || `กำลังไฮไลต์ ${highlightIds.size} คน`}</span>
              {onClearHighlight && (
                <button
                  onClick={onClearHighlight}
                  className="p-0.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
                  title="ล้างการไฮไลต์"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom-left floating toolbars: Zoom + Card Style + Tree Orientation + Collapse/Expand */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 max-w-[calc(100%-210px)]">
          {/* Zoom Pill */}
          <div
            style={{ backgroundColor: floatingBarBg, borderColor: palette.border }}
            className="flex items-center backdrop-blur-md rounded-xl border shadow-md p-1 gap-0.5"
          >
            <button
              onClick={() => zoomBy(0.84)}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
              title="ซูมออก"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={fitToScreen}
              className="px-1.5 py-1 text-xs font-medium hover:bg-black/5 rounded-lg min-w-[46px] text-center cursor-pointer"
              title="ปรับขนาดให้พอดีหน้าจอ"
            >
              {Math.round(transform.scale * 100)}%
            </button>
            <button
              onClick={() => zoomBy(1.2)}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
              title="ซูมเข้า"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div style={{ backgroundColor: palette.border }} className="w-px h-4 mx-0.5" />
            <button
              onClick={fitToScreen}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
              title="จัดกึ่งกลางพอดีจอ"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card Style Switcher: ละเอียด | กะทัดรัด | รูป+ชื่อ */}
          <div
            style={{ backgroundColor: floatingBarBg, borderColor: palette.border }}
            className="flex items-center backdrop-blur-md rounded-xl border shadow-md p-1 gap-0.5"
          >
            {CARD_STYLE_OPTIONS.map(({ id, label, title, icon: Icon }) => {
              const active = cardStyle === id;
              return (
                <button
                  key={id}
                  onClick={() => onChangeCardStyle(id)}
                  title={title}
                  style={
                    active
                      ? { backgroundColor: palette.primary, color: '#fff' }
                      : { color: palette.textMuted }
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:opacity-90"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Tree Orientation Switcher: บน→ล่าง | ล่าง→บน | แนวตั้ง (ซ้าย→ขวา) */}
          <div
            style={{ backgroundColor: floatingBarBg, borderColor: palette.border }}
            className="flex items-center backdrop-blur-md rounded-xl border shadow-md p-1 gap-0.5"
          >
            {ORIENTATION_OPTIONS.map(({ id, label, title, icon: Icon }) => {
              const active = orientation === id;
              return (
                <button
                  key={id}
                  onClick={() => onChangeOrientation(id)}
                  title={title}
                  style={
                    active
                      ? { backgroundColor: palette.accent, color: '#fff' }
                      : { color: palette.textMuted }
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer hover:opacity-90"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Expand / Collapse All + Minimap Toggle */}
          {!readOnly && (
            <div
              style={{ backgroundColor: floatingBarBg, borderColor: palette.border }}
              className="hidden sm:flex items-center backdrop-blur-md rounded-xl border shadow-md p-1 gap-0.5"
            >
              <button
                onClick={onExpandAll}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-black/5 transition-colors cursor-pointer"
                title="กางออกทุกสาย"
              >
                <Expand className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">กางหมด</span>
              </button>
              <button
                onClick={onCollapseToLevel2}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-black/5 transition-colors cursor-pointer"
                title="พับกิ่งรุ่นลูกหลาน"
              >
                <Shrink className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">พับกิ่ง</span>
              </button>
              <button
                onClick={() => setShowMinimap((m) => !m)}
                style={showMinimap ? { color: palette.primary } : { color: palette.textMuted }}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                title={showMinimap ? 'ซ่อนแผนที่ย่อ' : 'แสดงแผนที่ย่อ'}
              >
                <MapIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Interactive Minimap (Bottom-Right Corner — super helpful for big families!) */}
        {showMinimap && layout.cards.length >= 4 && (
          <div
            onClick={handleMinimapClick}
            style={{
              width: MINIMAP_W,
              height: MINIMAP_H,
              backgroundColor: floatingBarBg,
              borderColor: palette.border,
            }}
            title="แผนที่ย่อ — คลิกตรงไหนก็ได้เพื่อเลื่อนไปดูทันที"
            className="hidden md:block absolute bottom-4 right-4 z-20 rounded-xl border shadow-md backdrop-blur-md overflow-hidden cursor-pointer"
          >
            {/* Tiny node blocks */}
            {layout.cards.map((c) => (
              <div
                key={`mini_${c.person.id}`}
                style={{
                  left: miniOffsetX + c.x * miniScale,
                  top: miniOffsetY + c.y * miniScale,
                  width: Math.max(3, c.width * miniScale),
                  height: Math.max(2.5, c.height * miniScale),
                  backgroundColor:
                    selectedPersonId === c.person.id
                      ? palette.accent
                      : c.person.gender === 'male'
                        ? palette.primary
                        : palette.accent,
                  opacity: selectedPersonId === c.person.id ? 1 : 0.65,
                }}
                className="absolute rounded-[2px] pointer-events-none"
              />
            ))}

            {/* Current Viewport Indicator Box */}
            {(() => {
              const viewLeft = (-transform.x / transform.scale) * miniScale + miniOffsetX;
              const viewTop = (-transform.y / transform.scale) * miniScale + miniOffsetY;
              const viewW = (viewportSize.width / transform.scale) * miniScale;
              const viewH = (viewportSize.height / transform.scale) * miniScale;
              return (
                <div
                  style={{
                    left: Math.max(0, viewLeft),
                    top: Math.max(0, viewTop),
                    width: Math.min(MINIMAP_W, Math.max(12, viewW)),
                    height: Math.min(MINIMAP_H, Math.max(10, viewH)),
                    borderColor: palette.primary,
                    backgroundColor: palette.primarySoft,
                  }}
                  className="absolute border-[1.5px] rounded-sm opacity-45 pointer-events-none"
                />
              );
            })()}
          </div>
        )}

        {/* Interactive Pan/Zoom Surface */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative z-10 w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <div
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: '0 0',
              transition: isPanning ? 'none' : 'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            className="relative"
          >
            {/* SVG Layer for Parent-Child & Marriage Connectors */}
            <svg
              width={layout.width}
              height={layout.height}
              className="absolute inset-0 pointer-events-none overflow-visible"
            >
              {layout.parentChildConnectors.map((conn) => {
                const isHighlighted =
                  highlightIds &&
                  highlightIds.has(conn.childId) &&
                  conn.parentIds.some((pid) => highlightIds.has(pid));
                const isMuted = highlightIds && highlightIds.size > 0 && !isHighlighted;
                return (
                  <path
                    key={conn.id}
                    d={conn.path}
                    fill="none"
                    stroke={isHighlighted ? palette.accent : palette.connectorLine}
                    strokeWidth={isHighlighted ? 3 : 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isMuted ? 0.22 : 1}
                  />
                );
              })}

              {layout.marriageConnectors.map((mar) => {
                const isHighlighted =
                  highlightIds &&
                  highlightIds.has(mar.personAId) &&
                  highlightIds.has(mar.personBId);
                const isMuted = highlightIds && highlightIds.size > 0 && !isHighlighted;
                const midX = (mar.x1 + mar.x2) / 2;
                const midY = (mar.y1 + mar.y2) / 2;

                return (
                  <g key={mar.id} opacity={isMuted ? 0.25 : 1}>
                    <line
                      x1={mar.x1}
                      y1={mar.y1}
                      x2={mar.x2}
                      y2={mar.y2}
                      stroke={mar.status === 'divorced' ? '#C58E83' : palette.accent}
                      strokeWidth={isHighlighted ? 3 : 2}
                      strokeDasharray={mar.status === 'divorced' ? '4 4' : undefined}
                    />
                    <circle
                      cx={midX}
                      cy={midY}
                      r={7}
                      fill={palette.bgSurface}
                      stroke={mar.status === 'divorced' ? '#C58E83' : palette.accent}
                      strokeWidth={1.25}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Clickable Marriage Heart Buttons */}
            {layout.marriageConnectors.map((mar) => {
              const midX = (mar.x1 + mar.x2) / 2;
              const midY = (mar.y1 + mar.y2) / 2;
              const isMuted =
                highlightIds &&
                highlightIds.size > 0 &&
                !(highlightIds.has(mar.personAId) && highlightIds.has(mar.personBId));
              const spLink = data.members[mar.personAId]?.spouses.find(
                (s) => s.spouseId === mar.personBId
              );
              return (
                <div
                  key={`heart_${mar.id}`}
                  data-card-interactive="true"
                  style={{
                    left: midX - 11,
                    top: midY - 11,
                    opacity: isMuted ? 0.25 : 1,
                  }}
                  className="absolute z-10 flex flex-col items-center"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCoupleDetail?.(mar.personAId, mar.personBId);
                    }}
                    title={
                      spLink?.familyName
                        ? `${spLink.familyName} — คลิกดู/ตั้งค่ารายละเอียดคู่ครอบครัว`
                        : 'คลิกดู/ตั้งค่ารายละเอียดคู่ครอบครัว'
                    }
                    style={{
                      backgroundColor: palette.bgSurface,
                      borderColor: mar.status === 'divorced' ? '#C58E83' : palette.accent,
                      color: mar.status === 'divorced' ? '#C58E83' : palette.accent,
                    }}
                    className="w-[22px] h-[22px] rounded-full border shadow-xs flex items-center justify-center hover:scale-125 transition-transform cursor-pointer"
                  >
                    <Heart
                      className="w-3 h-3"
                      fill={mar.status === 'divorced' ? 'none' : 'currentColor'}
                    />
                  </button>
                  {spLink?.familyName && cardStyle === 'detailed' && orientation !== 'left-right' && (
                    <span
                      style={{
                        backgroundColor: palette.bgSurface,
                        borderColor: palette.border,
                        color: palette.accent,
                      }}
                      className="mt-1 px-1.5 py-0.5 rounded-full border text-[9px] font-semibold whitespace-nowrap shadow-2xs pointer-events-none"
                    >
                      {spLink.familyName}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Member Cards */}
            {layout.cards.map((card) => {
              const { person } = card;
              const isSelected = selectedPersonId === person.id;
              const isHighlighted = highlightIds?.has(person.id) ?? false;
              const dimmed = isCardDimmed(card);
              const age = calculateAge(person.birthDate, person.deathDate, person.isDeceased);
              const yearSpan = formatYearSpan(person.birthDate, person.deathDate, person.isDeceased);
              const siblingRank = getSiblingRankInfo(data.members, person.id);

              const stripeColor = person.isDeceased
                ? palette.textMuted
                : person.gender === 'male'
                  ? palette.primary
                  : person.gender === 'female'
                    ? palette.accent
                    : palette.connectorLine;

              const cardStyleProps: React.CSSProperties = {
                backgroundColor: person.isDeceased ? palette.bgSubtle : palette.bgSurface,
                borderColor: isSelected
                  ? palette.primary
                  : isHighlighted
                    ? palette.accent
                    : palette.border,
                boxShadow: isSelected
                  ? `0 10px 24px -6px rgba(0,0,0,0.18), 0 0 0 3px ${palette.primarySoft}`
                  : isHighlighted
                    ? `0 8px 18px -4px rgba(0,0,0,0.14), 0 0 0 2px ${palette.accentSoft}`
                    : '0 4px 12px -2px rgba(0,0,0,0.08)',
              };

              // Smart collapse button placement per orientation
              const collapsePosClass =
                orientation === 'left-right'
                  ? 'top-1/2 -translate-y-1/2 -right-3.5'
                  : orientation === 'bottom-up'
                    ? 'left-1/2 -translate-x-1/2 -top-3.5'
                    : 'left-1/2 -translate-x-1/2 -bottom-3.5';

              return (
                <div
                  key={person.id}
                  data-card-interactive="true"
                  style={{
                    left: card.x,
                    top: card.y,
                    width: card.width,
                    height: card.height,
                  }}
                  className={`absolute group transition-all duration-200 ${
                    dimmed ? 'opacity-28 saturate-50' : 'opacity-100'
                  }`}
                >
                  {/* STYLE A: PHOTO + NAME ONLY (Vertical Portrait Tile for Top-Down / Bottom-Up) */}
                  {cardStyle === 'photo-only' && orientation !== 'left-right' ? (
                    <div
                      onClick={() => onSelectPerson(person.id)}
                      style={cardStyleProps}
                      className={`relative w-full h-full rounded-2xl border p-2 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                        isSelected ? '-translate-y-0.5' : 'hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="relative">
                        <PersonAvatar person={person} size="lg" />
                        {siblingRank && (
                          <span
                            style={{ backgroundColor: palette.primary, color: '#fff' }}
                            title={siblingRank.label}
                            className="absolute -top-1 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs"
                          >
                            #{siblingRank.order}
                          </span>
                        )}
                      </div>
                      <div className="w-full min-w-0">
                        <div
                          style={{ color: palette.textMain }}
                          className="text-xs font-bold truncate leading-tight"
                        >
                          {person.firstName}
                        </div>
                        {person.nickname && (
                          <div
                            style={{ color: palette.accent }}
                            className="text-[10.5px] font-medium truncate leading-tight mt-0.5"
                          >
                            ({person.nickname})
                          </div>
                        )}
                      </div>
                    </div>
                  ) : cardStyle === 'photo-only' && orientation === 'left-right' ? (
                    /* STYLE B: PHOTO + NAME ONLY (Sleek Horizontal Pill for Left-Right Vertical Stack!) */
                    <div
                      onClick={() => onSelectPerson(person.id)}
                      style={cardStyleProps}
                      className={`relative w-full h-full rounded-2xl overflow-hidden border pl-3 pr-2.5 py-1.5 flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected ? '-translate-y-0.5' : 'hover:-translate-y-0.5'
                      }`}
                    >
                      <div
                        style={{ backgroundColor: stripeColor }}
                        className="absolute left-0 top-0 bottom-0 w-1.5"
                      />
                      <div className="relative shrink-0">
                        <PersonAvatar person={person} size="sm" />
                        {siblingRank && (
                          <span
                            style={{ backgroundColor: palette.primary, color: '#fff' }}
                            title={siblingRank.label}
                            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                          >
                            {siblingRank.order}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          style={{ color: palette.textMain }}
                          className="text-xs font-bold truncate leading-tight"
                        >
                          {person.firstName}
                        </div>
                        <div
                          style={{ color: person.nickname ? palette.accent : palette.textMuted }}
                          className="text-[10.5px] font-medium truncate leading-tight mt-0.5"
                        >
                          {person.nickname || person.lastName || `รุ่น ${card.generation}`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* STYLE C: DETAILED or COMPACT CARD */
                    <div
                      onClick={() => onSelectPerson(person.id)}
                      style={cardStyleProps}
                      className={`relative w-full h-full rounded-2xl overflow-hidden border transition-all cursor-pointer flex items-center gap-2.5 ${
                        cardStyle === 'compact' ? 'pl-3 pr-2.5 py-2' : 'pl-3.5 pr-3 py-2.5'
                      } ${isSelected ? '-translate-y-0.5' : 'hover:-translate-y-0.5'}`}
                    >
                      <div
                        style={{ backgroundColor: stripeColor }}
                        className="absolute left-0 top-0 bottom-0 w-1.5"
                      />

                      <PersonAvatar person={person} size={cardStyle === 'compact' ? 'sm' : 'md'} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              style={{ backgroundColor: palette.bgSubtle, color: palette.textMuted }}
                              className="text-[9.5px] font-medium px-1.5 py-0.2 rounded shrink-0"
                            >
                              รุ่น {card.generation}
                            </span>
                            {siblingRank && (
                              <span
                                style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
                                className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded shrink-0"
                                title={siblingRank.label}
                              >
                                {siblingRank.shortLabel}
                              </span>
                            )}
                            {person.nickname && cardStyle === 'detailed' && (
                              <span
                                style={{ color: palette.accent }}
                                className="text-[10.5px] font-semibold truncate"
                              >
                                {person.nickname}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {person.notes && (
                              <span title={`หมายเหตุ: ${person.notes}`}>
                                <StickyNote className="w-3 h-3" style={{ color: palette.accent }} />
                              </span>
                            )}
                            {person.gallery && person.gallery.length > 0 && (
                              <span title={`มีรูปภาพในอัลบั้ม ${person.gallery.length} รูป`}>
                                <Images className="w-3 h-3" style={{ color: palette.primary }} />
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          style={{ color: palette.textMain }}
                          className={`font-semibold truncate leading-tight ${
                            cardStyle === 'compact' ? 'text-xs' : 'text-[13.5px]'
                          }`}
                        >
                          {person.title ? `${person.title} ` : ''}
                          {person.firstName}
                        </div>

                        {person.lastName && (
                          <div
                            style={{ color: palette.textMuted }}
                            className="text-[11.5px] truncate leading-tight mt-0.5"
                          >
                            {person.lastName}
                          </div>
                        )}

                        {cardStyle === 'detailed' && (
                          <div className="flex items-center justify-between gap-1.5 mt-1.5">
                            <span
                              style={{ color: palette.textMuted }}
                              className="text-[10.5px] truncate"
                            >
                              {yearSpan
                                ? age != null
                                  ? `${yearSpan} (${age} ปี)`
                                  : yearSpan
                                : person.occupation || 'คลิกดูรายละเอียด'}
                            </span>
                            {person.isDeceased && (
                              <span
                                style={{ backgroundColor: palette.bgSubtle, color: palette.textMuted }}
                                className="text-[9.5px] px-1.5 py-0.5 rounded-full shrink-0"
                              >
                                ล่วงลับ
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick-Add "+" hover trigger (hidden in readOnly Easy Mode) */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAdd(person.id, 'child');
                      }}
                      title="เพิ่มบุตรของคนนี้"
                      style={{ backgroundColor: palette.primary }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full text-white shadow-md flex items-center justify-center hover:scale-110 transition-all cursor-pointer z-20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Collapse / Expand branch button positioned per orientation */}
                  {card.hasChildren && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleCollapse(person.id);
                      }}
                      title={card.isCollapsed ? 'กางสายลูกหลานออก' : 'พับสายลูกหลาน'}
                      style={
                        card.isCollapsed
                          ? { backgroundColor: palette.accent, color: '#fff', borderColor: palette.accent }
                          : { backgroundColor: palette.bgSurface, color: palette.textMuted, borderColor: palette.border }
                      }
                      className={`absolute ${collapsePosClass} z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border shadow-sm transition-all cursor-pointer`}
                    >
                      {card.isCollapsed ? (
                        <>
                          {orientation === 'left-right' ? (
                            <ChevronRight className="w-3 h-3" />
                          ) : orientation === 'bottom-up' ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                          <span>+{card.hiddenDescendantCount}</span>
                        </>
                      ) : orientation === 'left-right' ? (
                        <ChevronLeft className="w-3 h-3" />
                      ) : orientation === 'bottom-up' ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronUp className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

TreeCanvas.displayName = 'TreeCanvas';
