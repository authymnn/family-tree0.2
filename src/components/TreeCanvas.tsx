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
  SlidersHorizontal,
  Home,
  GraduationCap,
  Check,
  Crosshair,
} from 'lucide-react';
import {
  CardStyle,
  FamilyTreeData,
  Person,
  QuickAddRelation,
  ThemeSettings,
  TreeOrientation,
} from '../types/family';
import { ThemePalette } from '../utils/themes';
import { computeFamilyTreeLayout, PositionedCard } from '../utils/treeLayout';
import { calculateAge, formatYearSpan } from '../utils/dateUtils';
import {
  getCoupleColor,
  getMemberFamilyColor,
  getSiblingRankInfo,
  getUnitFamilyColor,
} from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';
import { CanvasBackground } from './CanvasBackground';

export interface TreeCanvasHandle {
  focusPerson: (personId: string) => void;
  fitToScreen: () => void;
}

interface TreeCanvasProps {
  data: FamilyTreeData;
  selectedPersonId: string | null;
  previewPersonId?: string | null;
  previewPopover?: React.ReactNode;
  highlightIds: Set<string> | null;
  highlightLabel?: string | null;
  onClearHighlight?: () => void;
  focusRootId: string | null;
  onFocusSubtree?: (personId: string) => void;
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

function collectHouseMemberIds(
  members: Record<string, Person>,
  rootPersonId: string
): Set<string> {
  const result = new Set<string>();
  const root = members[rootPersonId];
  if (!root) return result;
  const queue: string[] = [rootPersonId];
  result.add(rootPersonId);
  for (const sp of root.spouses) {
    if (members[sp.spouseId]) {
      result.add(sp.spouseId);
      queue.push(sp.spouseId);
    }
  }
  const all = Object.values(members);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const m of all) {
      if (!result.has(m.id) && m.parentIds.includes(curr)) {
        result.add(m.id);
        queue.push(m.id);
        for (const sp of m.spouses) {
          if (members[sp.spouseId] && !result.has(sp.spouseId)) {
            result.add(sp.spouseId);
            queue.push(sp.spouseId);
          }
        }
      }
    }
  }
  return result;
}

function isPersonStudying(p: Person): boolean {
  if (p.educationStatus === 'studying') return true;
  if (p.educationStatus === 'graduated') return false;
  const edu = (p.education || '').trim();
  if (!edu) return false;
  return /^(ป\.|ม\.|อ\.|ปี\s*\d|grade|ศพด|สพด|น\.ร)/i.test(edu);
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
      previewPersonId = null,
      previewPopover = null,
      highlightIds,
      highlightLabel,
      onClearHighlight,
      focusRootId,
      onFocusSubtree,
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
    const [isInteracting, setIsInteracting] = useState(false);

    // Multi-touch pointer tracking for 1-finger pan + 2-finger pinch-to-zoom on mobile!
    const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
    const pinchStartRef = useRef<{
      dist: number;
      midX: number;
      midY: number;
      scale: number;
      tx: number;
      ty: number;
    } | null>(null);
    const transformRef = useRef(transform);
    transformRef.current = transform;
    const didDragRef = useRef(false);

    const [branchFilter, setBranchFilter] = useState<string>('ALL');
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [selectedGens, setSelectedGens] = useState<Set<number>>(() => new Set());
    const [selectedHouseIds, setSelectedHouseIds] = useState<Set<string>>(() => new Set());
    const [lifeFilter, setLifeFilter] = useState<'all' | 'living' | 'deceased'>('all');
    const [eduFilter, setEduFilter] = useState<'all' | 'studying' | 'graduated' | 'working'>('all');
    const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
    const [photoFilter, setPhotoFilter] = useState<'all' | 'has-photo' | 'no-photo'>('all');
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
        const targetScale = Math.max(transformRef.current.scale, 0.95);
        const cx = card.x + card.width / 2;
        const cy = card.y + card.height / 2;
        const centerOffsetX = !readOnly && rect.width > 960 ? -130 : 0;
        setTransform({
          x: rect.width / 2 + centerOffsetX - cx * targetScale,
          y: rect.height / 2 - cy * targetScale,
          scale: targetScale,
        });
      },
      [layout.cards, readOnly]
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
        const nextScale = Math.max(0.18, Math.min(2.6, prev.scale * zoomFactor));
        const ratio = nextScale / prev.scale;
        return {
          scale: nextScale,
          x: mouseX - (mouseX - prev.x) * ratio,
          y: mouseY - (mouseY - prev.y) * ratio,
        };
      });
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      // On desktop mouse, skip pan if clicking directly on an interactive card/button
      // On mobile touch, ALWAYS track pointers so 2-finger pinch works even when fingers land on cards!
      const isTouch = e.pointerType === 'touch';
      if (!isTouch && (e.target as HTMLElement).closest('[data-card-interactive="true"]')) return;
      if (!isTouch && e.button !== 0) return;

      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointersRef.current.size === 1) {
        didDragRef.current = false;
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        };
        pinchStartRef.current = null;
        if (!isTouch) {
          setIsInteracting(true);
          try {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }
      } else if (activePointersRef.current.size === 2) {
        // Begin 2-finger pinch-to-zoom!
        didDragRef.current = true;
        setIsInteracting(true);
        const pts = Array.from(activePointersRef.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const container = containerRef.current;
        const rect = container?.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0);
        const midY = (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0);
        pinchStartRef.current = {
          dist: Math.max(10, dist),
          midX,
          midY,
          scale: transformRef.current.scale,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        };
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointersRef.current.size >= 2 && pinchStartRef.current) {
        const pts = Array.from(activePointersRef.current.values());
        const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const container = containerRef.current;
        const rect = container?.getBoundingClientRect();
        const newMidX = (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0);
        const newMidY = (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0);

        const start = pinchStartRef.current;
        const nextScale = Math.max(0.18, Math.min(2.6, start.scale * (newDist / start.dist)));
        const ratio = nextScale / start.scale;

        // Zoom smoothly centered right between the two fingers + follow midpoint pan
        const nextX = newMidX - (start.midX - start.tx) * ratio;
        const nextY = newMidY - (start.midY - start.ty) * ratio;

        didDragRef.current = true;
        setTransform({ x: nextX, y: nextY, scale: nextScale });
      } else if (activePointersRef.current.size === 1) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          didDragRef.current = true;
          if (!isInteracting) setIsInteracting(true);
        }
        if (didDragRef.current || e.pointerType !== 'touch') {
          setTransform((prev) => ({
            ...prev,
            x: panStartRef.current.tx + dx,
            y: panStartRef.current.ty + dy,
          }));
        }
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      activePointersRef.current.delete(e.pointerId);

      if (activePointersRef.current.size === 1) {
        // Transition smoothly from 2-finger pinch back to 1-finger pan without jumping
        const remaining = Array.from(activePointersRef.current.values())[0];
        pinchStartRef.current = null;
        panStartRef.current = {
          x: remaining.x,
          y: remaining.y,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        };
      } else if (activePointersRef.current.size === 0) {
        pinchStartRef.current = null;
        setIsInteracting(false);
        // Reset drag flag shortly after pointer release so normal taps work immediately
        setTimeout(() => {
          didDragRef.current = false;
        }, 60);
      }
    };

    const handleSafeCardClick = (personId: string) => {
      if (didDragRef.current) return;
      onSelectPerson(personId);
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

    // Build selectable household list (Gen-2 children / main houses with spouse or children)
    const houseOptions = useMemo(() => {
      const houses: Array<{
        rootId: string;
        label: string;
        color: string;
        memberIds: Set<string>;
      }> = [];
      const seen = new Set<string>();
      const gen2Cards = layout.cards
        .filter((c) => c.generation === 2 && !c.isSpouseInUnit)
        .sort((a, b) => (a.person.birthOrder ?? 99) - (b.person.birthOrder ?? 99));

      for (const c of gen2Cards) {
        if (seen.has(c.person.id)) continue;
        seen.add(c.person.id);
        const firstSpouseId = c.person.spouses[0]?.spouseId;
        const spouse = firstSpouseId ? data.members[firstSpouseId] : undefined;
        const spLink = c.person.spouses[0];
        const label =
          spLink?.familyName?.trim() ||
          (spouse
            ? `บ้าน${c.person.firstName}${c.person.nickname ? ` (${c.person.nickname})` : ''}`
            : `สาย${c.person.firstName}${c.person.nickname ? ` (${c.person.nickname})` : ''}`);
        const color = spouse
          ? getCoupleColor(c.person.id, spouse.id, spLink?.color)
          : getMemberFamilyColor(data.members, c.person.id);
        const memberIds = collectHouseMemberIds(data.members, c.person.id);
        houses.push({ rootId: c.person.id, label, color, memberIds });
      }
      return houses;
    }, [layout.cards, data.members]);

    const generationCounts = useMemo(() => {
      const counts = new Map<number, number>();
      for (const c of layout.cards) {
        counts.set(c.generation, (counts.get(c.generation) || 0) + 1);
      }
      return Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
    }, [layout.cards]);

    const hasCustomFilter =
      branchFilter !== 'ALL' ||
      selectedGens.size > 0 ||
      selectedHouseIds.size > 0 ||
      lifeFilter !== 'all' ||
      eduFilter !== 'all' ||
      genderFilter !== 'all' ||
      photoFilter !== 'all';

    const activeFilterCount =
      (branchFilter !== 'ALL' ? 1 : 0) +
      (selectedGens.size > 0 ? 1 : 0) +
      (selectedHouseIds.size > 0 ? 1 : 0) +
      (lifeFilter !== 'all' ? 1 : 0) +
      (eduFilter !== 'all' ? 1 : 0) +
      (genderFilter !== 'all' ? 1 : 0) +
      (photoFilter !== 'all' ? 1 : 0);

    const resetAllFilters = () => {
      setBranchFilter('ALL');
      setSelectedGens(new Set());
      setSelectedHouseIds(new Set());
      setLifeFilter('all');
      setEduFilter('all');
      setGenderFilter('all');
      setPhotoFilter('all');
    };

    const allowedHouseMemberIds = useMemo(() => {
      if (selectedHouseIds.size === 0) return null;
      const union = new Set<string>();
      for (const h of houseOptions) {
        if (selectedHouseIds.has(h.rootId)) {
          for (const id of h.memberIds) union.add(id);
        }
      }
      return union;
    }, [selectedHouseIds, houseOptions]);

    const matchesCustomFilter = useCallback(
      (card: PositionedCard): boolean => {
        const p = card.person;
        if (branchFilter !== 'ALL' && (p.branch || 'ไม่ระบุสาย') !== branchFilter) return false;
        if (selectedGens.size > 0 && !selectedGens.has(card.generation)) return false;
        if (allowedHouseMemberIds && !allowedHouseMemberIds.has(p.id)) return false;
        if (lifeFilter === 'living' && p.isDeceased) return false;
        if (lifeFilter === 'deceased' && !p.isDeceased) return false;
        if (eduFilter === 'studying' && !isPersonStudying(p)) return false;
        if (eduFilter === 'graduated' && p.educationStatus !== 'graduated') return false;
        if (eduFilter === 'working' && !p.occupation?.trim()) return false;
        if (genderFilter !== 'all' && p.gender !== genderFilter) return false;
        if (photoFilter === 'has-photo' && !p.photo) return false;
        if (photoFilter === 'no-photo' && Boolean(p.photo)) return false;
        return true;
      },
      [branchFilter, selectedGens, allowedHouseMemberIds, lifeFilter, eduFilter, genderFilter, photoFilter]
    );

    const matchedFilterCount = useMemo(() => {
      if (!hasCustomFilter) return layout.cards.length;
      return layout.cards.filter(matchesCustomFilter).length;
    }, [hasCustomFilter, layout.cards, matchesCustomFilter]);

    const isCardDimmed = (card: PositionedCard): boolean => {
      if (highlightIds && highlightIds.size > 0) {
        return !highlightIds.has(card.person.id);
      }
      if (hasCustomFilter) {
        return !matchesCustomFilter(card);
      }
      return false;
    };

    const anchoredCard = useMemo(
      () => (previewPersonId ? layout.cards.find((c) => c.person.id === previewPersonId) ?? null : null),
      [previewPersonId, layout.cards]
    );

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

        {/* Top-left floating bar: Multi-Checkbox Tree Filter + Active Focus/Highlight Banners */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 max-w-[calc(100%-32px)] pointer-events-none">
          {/* Smart Multi-Filter Trigger + Popover */}
          <div className="relative pointer-events-auto">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Tree Filter ("ตัวกรองผัง") Button */}
              <button
                type="button"
                onClick={() => {
                  setShowFilterMenu((v) => !v);
                  setShowViewMenu(false);
                }}
                style={
                  hasCustomFilter || showFilterMenu
                    ? { backgroundColor: palette.primary, color: '#fff', borderColor: palette.primary }
                    : { backgroundColor: floatingBarBg, color: palette.textMain, borderColor: palette.border }
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-sm text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>ตัวกรองผัง</span>
                {hasCustomFilter && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/25 text-[10.5px] font-bold">
                    {matchedFilterCount}/{layout.cards.length}
                  </span>
                )}
              </button>

              {hasCustomFilter && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  style={{ backgroundColor: floatingBarBg, borderColor: palette.border, color: palette.textMain }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border backdrop-blur-md shadow-sm text-xs font-medium hover:opacity-85 cursor-pointer"
                  title="ล้างตัวกรองทั้งหมดเพื่อดูทุกคน"
                >
                  <X className="w-3.5 h-3.5" />
                  ดูทั้งหมด
                </button>
              )}
            </div>

            {/* Popover: Tree Filter ("ตัวกรองผัง") */}
            {showFilterMenu && (
              <div
                style={{
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.border,
                  color: palette.textMain,
                }}
                className="absolute left-0 top-full mt-2 w-[310px] sm:w-[350px] max-w-[calc(100vw-32px)] max-h-[70vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col animate-fade-in"
              >
                <div
                  style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                  className="px-4 py-2.5 border-b flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                    <span className="text-xs font-bold">
                      เลือกดูผังตระกูล ({matchedFilterCount}/{layout.cards.length} คน)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        style={{ color: palette.primary }}
                        className="text-[11px] font-semibold hover:underline cursor-pointer"
                      >
                        ดูทั้งหมด
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowFilterMenu(false)}
                      className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3.5 space-y-3.5 overflow-y-auto text-xs">
                  {/* 1. Generations (Multi-checkbox) */}
                  <div className="space-y-1.5">
                    <div style={{ color: palette.textMuted }} className="text-[11px] font-semibold">
                      เลือกรุ่น (ติ๊กได้หลายรุ่น)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedGens(new Set())}
                        style={
                          selectedGens.size === 0
                            ? { backgroundColor: palette.primary, color: '#fff', borderColor: palette.primary }
                            : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                        }
                        className="px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer"
                      >
                        ทุกรุ่น
                      </button>
                      {generationCounts.map(([gen, cnt]) => {
                        const checked = selectedGens.has(gen);
                        return (
                          <button
                            key={gen}
                            type="button"
                            onClick={() =>
                              setSelectedGens((prev) => {
                                const next = new Set(prev);
                                if (next.has(gen)) next.delete(gen);
                                else next.add(gen);
                                return next;
                              })
                            }
                            style={
                              checked
                                ? { backgroundColor: palette.primarySoft, color: palette.primary, borderColor: palette.primary }
                                : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer"
                          >
                            {checked && <Check className="w-3 h-3" />}
                            รุ่น {gen} ({cnt})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Households / Sub-families (Multi-checkbox + 1-click Isolate Focus) */}
                  {houseOptions.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: palette.border }}>
                      <div className="flex items-center justify-between">
                        <span
                          style={{ color: palette.textMuted }}
                          className="text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Home className="w-3 h-3" />
                          เฉพาะบ้าน / ครอบครัว (ติ๊กหลายบ้านได้)
                        </span>
                        {selectedHouseIds.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedHouseIds(new Set())}
                            style={{ color: palette.primary }}
                            className="text-[10.5px] hover:underline cursor-pointer"
                          >
                            ล้าง
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                        {houseOptions.map((h) => {
                          const checked = selectedHouseIds.has(h.rootId);
                          return (
                            <div
                              key={h.rootId}
                              style={{
                                backgroundColor: checked ? `${h.color}16` : palette.bgSubtle,
                                borderColor: checked ? h.color : palette.border,
                              }}
                              className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedHouseIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(h.rootId)) next.delete(h.rootId);
                                    else next.add(h.rootId);
                                    return next;
                                  })
                                }
                                className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                              >
                                <span
                                  style={{
                                    backgroundColor: checked ? h.color : 'transparent',
                                    borderColor: h.color,
                                  }}
                                  className="w-4 h-4 rounded flex items-center justify-center border shrink-0 text-white"
                                >
                                  {checked && <Check className="w-3 h-3" />}
                                </span>
                                <span className="text-[11.5px] font-medium truncate">{h.label}</span>
                                <span style={{ color: palette.textMuted }} className="text-[10px] shrink-0">
                                  ({h.memberIds.size})
                                </span>
                              </button>
                              {onFocusSubtree && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onFocusSubtree(h.rootId);
                                    setShowFilterMenu(false);
                                  }}
                                  style={{ color: h.color }}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md hover:bg-black/5 text-[10px] font-semibold shrink-0 cursor-pointer"
                                  title="ซ่อนบ้านอื่นแล้วแสดงเฉพาะบ้านนี้เต็มจอ"
                                >
                                  <Crosshair className="w-3 h-3" />
                                  โฟกัส
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3. Education & Work Status */}
                  <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: palette.border }}>
                    <div
                      style={{ color: palette.textMuted }}
                      className="text-[11px] font-semibold flex items-center gap-1"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      การศึกษา & อาชีพ
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'all', label: 'ทั้งหมด' },
                          { id: 'studying', label: 'กำลังศึกษาอยู่' },
                          { id: 'graduated', label: 'เรียนจบแล้ว' },
                          { id: 'working', label: 'วัยทำงาน (มีอาชีพ)' },
                        ] as const
                      ).map(({ id, label }) => {
                        const active = eduFilter === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setEduFilter(id)}
                            style={
                              active
                                ? { backgroundColor: palette.primarySoft, color: palette.primary, borderColor: palette.primary }
                                : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                            }
                            className="px-2.5 py-1.5 rounded-lg border text-[11px] font-medium text-left flex items-center gap-1 cursor-pointer"
                          >
                            {active && <Check className="w-3 h-3 shrink-0" />}
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Life Status, Gender & Photo Completeness */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2 border-t" style={{ borderColor: palette.border }}>
                    <div className="space-y-1">
                      <div style={{ color: palette.textMuted }} className="text-[10.5px] font-semibold">
                        สถานะชีวิต
                      </div>
                      <div className="flex flex-col gap-1">
                        {(
                          [
                            { id: 'all', label: 'ทั้งหมด' },
                            { id: 'living', label: 'ยังมีชีวิตอยู่' },
                            { id: 'deceased', label: 'ผู้ล่วงลับ' },
                          ] as const
                        ).map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setLifeFilter(id)}
                            style={
                              lifeFilter === id
                                ? { backgroundColor: palette.primarySoft, color: palette.primary, borderColor: palette.primary }
                                : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                            }
                            className="px-2 py-1 rounded-lg border text-[11px] font-medium text-left cursor-pointer"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div style={{ color: palette.textMuted }} className="text-[10.5px] font-semibold">
                        เพศ / รูปโปรไฟล์
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { id: 'all', label: 'ทุกเพศ' },
                              { id: 'male', label: 'ชาย' },
                              { id: 'female', label: 'หญิง' },
                            ] as const
                          ).map(({ id, label }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setGenderFilter(id)}
                              style={
                                genderFilter === id
                                  ? { backgroundColor: palette.accentSoft, color: palette.accent, borderColor: palette.accent }
                                  : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                              }
                              className="py-1 rounded-lg border text-[10.5px] font-medium text-center cursor-pointer"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {(
                            [
                              { id: 'has-photo', label: 'มีรูปแล้ว' },
                              { id: 'no-photo', label: 'ยังไม่มีรูป' },
                            ] as const
                          ).map(({ id, label }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setPhotoFilter((prev) => (prev === id ? 'all' : id))}
                              style={
                                photoFilter === id
                                  ? { backgroundColor: palette.primarySoft, color: palette.primary, borderColor: palette.primary }
                                  : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                              }
                              className="py-1 px-1.5 rounded-lg border text-[10.5px] font-medium text-center cursor-pointer"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Branches (if multiple) */}
                  {branches.length > 1 && (
                    <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: palette.border }}>
                      <div
                        style={{ color: palette.textMuted }}
                        className="text-[11px] font-semibold flex items-center gap-1"
                      >
                        <GitBranch className="w-3 h-3" />
                        สายตระกูล
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBranchFilter('ALL')}
                          style={
                            branchFilter === 'ALL'
                              ? { backgroundColor: palette.primary, color: '#fff', borderColor: palette.primary }
                              : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                          }
                          className="px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer"
                        >
                          ทุกสาย
                        </button>
                        {branches.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setBranchFilter(b)}
                            style={
                              branchFilter === b
                                ? { backgroundColor: palette.accent, color: '#fff', borderColor: palette.accent }
                                : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                            }
                            className="px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

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

        {/* Bottom-Right Corner Stack: Interactive Minimap + View Options ("มุมมองการดู") Button & Upward Popover */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none">
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
              className="pointer-events-auto hidden md:block relative rounded-xl border shadow-md backdrop-blur-md overflow-hidden cursor-pointer"
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

          {/* Bottom-Right View Options ("มุมมองการดู") Button + Upward Popover */}
          <div className="relative pointer-events-auto">
            {showViewMenu && (
              <div
                style={{
                  backgroundColor: palette.bgSurface,
                  borderColor: palette.border,
                  color: palette.textMain,
                }}
                className="absolute right-0 bottom-full mb-2 w-[300px] sm:w-[330px] max-w-[calc(100vw-32px)] max-h-[72vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col animate-fade-in"
              >
                <div
                  style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                  className="px-4 py-2.5 border-b flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-3.5 h-3.5" style={{ color: palette.accent }} />
                    <span className="text-xs font-bold">มุมมองการดูผังตระกูล</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowViewMenu(false)}
                    className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-3.5 space-y-3.5 overflow-y-auto text-xs">
                  {/* 1. Zoom Controls */}
                  <div className="space-y-1.5">
                    <div style={{ color: palette.textMuted }} className="text-[11px] font-semibold">
                      ขนาดการซูม ({Math.round(transform.scale * 100)}%)
                    </div>
                    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => zoomBy(0.84)}
                        style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                        className="p-2 rounded-xl border hover:opacity-85 cursor-pointer"
                        title="ซูมออก"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={fitToScreen}
                        style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                        className="py-2 px-2 rounded-xl border text-xs font-bold text-center hover:opacity-85 cursor-pointer"
                        title="ปรับขนาดให้พอดีหน้าจอ"
                      >
                        {Math.round(transform.scale * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => zoomBy(1.2)}
                        style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                        className="p-2 rounded-xl border hover:opacity-85 cursor-pointer"
                        title="ซูมเข้า"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={fitToScreen}
                        style={{ backgroundColor: palette.primarySoft, color: palette.primary, borderColor: palette.primary }}
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-[11px] font-semibold hover:opacity-85 cursor-pointer"
                        title="จัดกึ่งกลางพอดีจอ"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        พอดีจอ
                      </button>
                    </div>
                  </div>

                  {/* 2. Card Style */}
                  <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: palette.border }}>
                    <div style={{ color: palette.textMuted }} className="text-[11px] font-semibold">
                      รูปแบบการ์ดสมาชิก
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CARD_STYLE_OPTIONS.map(({ id, label, title, icon: Icon }) => {
                        const active = cardStyle === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onChangeCardStyle(id)}
                            title={title}
                            style={
                              active
                                ? { backgroundColor: palette.primary, color: '#fff', borderColor: palette.primary }
                                : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                            }
                            className="flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Icon className="w-4 h-4" />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Tree Orientation */}
                  <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: palette.border }}>
                    <div style={{ color: palette.textMuted }} className="text-[11px] font-semibold">
                      ทิศทางของแผนผัง
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {ORIENTATION_OPTIONS.map(({ id, label, title, icon: Icon }) => {
                        const active = orientation === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onChangeOrientation(id)}
                            title={title}
                            style={
                              active
                                ? { backgroundColor: palette.accent, color: '#fff', borderColor: palette.accent }
                                : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                            }
                            className="flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Icon className="w-4 h-4" />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Branch Collapse/Expand & Minimap */}
                  <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: palette.border }}>
                    <div style={{ color: palette.textMuted }} className="text-[11px] font-semibold">
                      การพับ-กางสาย & แผนที่ย่อ
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={onExpandAll}
                        style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                        className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-[11px] font-semibold hover:opacity-85 cursor-pointer"
                        title="กางออกทุกสาย"
                      >
                        <Expand className="w-3.5 h-3.5" />
                        กางหมด
                      </button>
                      <button
                        type="button"
                        onClick={onCollapseToLevel2}
                        style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                        className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-[11px] font-semibold hover:opacity-85 cursor-pointer"
                        title="พับกิ่งรุ่นลูกหลาน"
                      >
                        <Shrink className="w-3.5 h-3.5" />
                        พับกิ่ง
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMinimap((m) => !m)}
                        style={
                          showMinimap
                            ? { backgroundColor: palette.primarySoft, color: palette.primary, borderColor: palette.primary }
                            : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
                        }
                        className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-[11px] font-semibold hover:opacity-85 cursor-pointer"
                        title={showMinimap ? 'ซ่อนแผนที่ย่อ' : 'แสดงแผนที่ย่อ'}
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        แผนที่
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowViewMenu((v) => !v);
                setShowFilterMenu(false);
              }}
              style={
                showViewMenu
                  ? { backgroundColor: palette.accent, color: '#fff', borderColor: palette.accent }
                  : { backgroundColor: floatingBarBg, color: palette.textMain, borderColor: palette.border }
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border backdrop-blur-md shadow-md text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>มุมมองการดู</span>
              <span
                style={
                  showViewMenu
                    ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { backgroundColor: palette.bgSubtle, color: palette.textMuted }
                }
                className="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
              >
                {Math.round(transform.scale * 100)}%
              </span>
            </button>
          </div>
        </div>

        {/* Interactive Pan/Zoom Surface (supports mouse wheel + 1-finger pan + 2-finger mobile pinch-to-zoom!) */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none' }}
          className={`relative z-10 w-full h-full touch-none ${isInteracting ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <div
            style={{
              width: layout.width,
              height: layout.height,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: '0 0',
              transition: isInteracting ? 'none' : 'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            className="relative"
          >
            {/* SVG Layer for Crisp, High-Clarity Family-Colored Parent-Child & Marriage Connectors */}
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
                const familyColor = getUnitFamilyColor(data.members, conn.parentIds);
                return (
                  <g key={conn.id} opacity={isMuted ? 0.18 : 1}>
                    {/* Soft background halo so lines pop crisply over any photo/tree background */}
                    <path
                      d={conn.path}
                      fill="none"
                      stroke={palette.bgSurface}
                      strokeWidth={isHighlighted ? 7.5 : 5.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.7}
                    />
                    <path
                      d={conn.path}
                      fill="none"
                      stroke={isHighlighted ? palette.accent : familyColor}
                      strokeWidth={isHighlighted ? 4.2 : 3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
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
                const spLink = data.members[mar.personAId]?.spouses.find(
                  (s) => s.spouseId === mar.personBId
                );
                const partnerSpLink = data.members[mar.personBId]?.spouses.find(
                  (s) => s.spouseId === mar.personAId
                );
                const coupleColor = getCoupleColor(
                  mar.personAId,
                  mar.personBId,
                  spLink?.color || partnerSpLink?.color
                );

                return (
                  <g key={mar.id} opacity={isMuted ? 0.2 : 1}>
                    <line
                      x1={mar.x1}
                      y1={mar.y1}
                      x2={mar.x2}
                      y2={mar.y2}
                      stroke={palette.bgSurface}
                      strokeWidth={6}
                      opacity={0.75}
                    />
                    <line
                      x1={mar.x1}
                      y1={mar.y1}
                      x2={mar.x2}
                      y2={mar.y2}
                      stroke={mar.status === 'divorced' ? '#C58E83' : coupleColor}
                      strokeWidth={isHighlighted ? 4.2 : 3.2}
                      strokeDasharray={mar.status === 'divorced' ? '5 4' : undefined}
                    />
                    <circle
                      cx={midX}
                      cy={midY}
                      r={8}
                      fill={palette.bgSurface}
                      stroke={mar.status === 'divorced' ? '#C58E83' : coupleColor}
                      strokeWidth={2}
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
              const partnerSpLink = data.members[mar.personBId]?.spouses.find(
                (s) => s.spouseId === mar.personAId
              );
              const coupleColor = getCoupleColor(
                mar.personAId,
                mar.personBId,
                spLink?.color || partnerSpLink?.color
              );
              return (
                <div
                  key={`heart_${mar.id}`}
                  data-card-interactive="true"
                  style={{
                    left: midX - 12,
                    top: midY - 12,
                    opacity: isMuted ? 0.25 : 1,
                  }}
                  className="absolute z-10 flex flex-col items-center"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (didDragRef.current) return;
                      onOpenCoupleDetail?.(mar.personAId, mar.personBId);
                    }}
                    title={
                      spLink?.familyName
                        ? `${spLink.familyName} — คลิกดู/ตั้งค่ารายละเอียดและสีครอบครัว`
                        : 'คลิกดู/ตั้งค่ารายละเอียดและสีครอบครัว'
                    }
                    style={{
                      backgroundColor: palette.bgSurface,
                      borderColor: mar.status === 'divorced' ? '#C58E83' : coupleColor,
                      color: mar.status === 'divorced' ? '#C58E83' : coupleColor,
                    }}
                    className="w-[24px] h-[24px] rounded-full border-2 shadow-sm flex items-center justify-center hover:scale-125 transition-transform cursor-pointer"
                  >
                    <Heart
                      className="w-3 h-3"
                      fill={mar.status === 'divorced' ? 'none' : 'currentColor'}
                    />
                  </button>
                  {spLink?.familyName && cardStyle === 'detailed' && orientation !== 'left-right' && (
                    <span
                      style={{
                        backgroundColor: coupleColor,
                        color: '#ffffff',
                      }}
                      className="mt-1 px-2 py-0.5 rounded-full text-[9.5px] font-semibold whitespace-nowrap shadow-xs pointer-events-none"
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
              const memberFamilyColor = getMemberFamilyColor(data.members, person.id);

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
                      onClick={() => handleSafeCardClick(person.id)}
                      style={cardStyleProps}
                      className={`relative w-full h-full rounded-2xl border p-2 flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                        isSelected ? '-translate-y-0.5' : 'hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="relative">
                        <PersonAvatar person={person} size="lg" />
                        {siblingRank && (
                          <span
                            style={{ backgroundColor: memberFamilyColor, color: '#fff' }}
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
                      onClick={() => handleSafeCardClick(person.id)}
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
                            style={{ backgroundColor: memberFamilyColor, color: '#fff' }}
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
                      onClick={() => handleSafeCardClick(person.id)}
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
                              style={{
                                backgroundColor: `${memberFamilyColor}1A`,
                                color: memberFamilyColor,
                                border: `1px solid ${memberFamilyColor}38`,
                              }}
                              className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded shrink-0"
                            >
                              รุ่น {card.generation}
                            </span>
                            {siblingRank && (
                              <span
                                style={{ backgroundColor: memberFamilyColor, color: '#ffffff' }}
                                className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded shrink-0 shadow-2xs"
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

        {/* Live Anchored Person Popover — physically attached beside the selected card, glides with pan/zoom! */}
        {anchoredCard && previewPopover && (() => {
          const isNarrow = viewportSize.width < 640;
          const popWidth = isNarrow ? Math.min(316, viewportSize.width - 20) : 356;
          const cardLeftX = transform.x + anchoredCard.x * transform.scale;
          const cardRightX = transform.x + (anchoredCard.x + anchoredCard.width) * transform.scale;
          const cardTopY = transform.y + anchoredCard.y * transform.scale;
          const cardBottomY = transform.y + (anchoredCard.y + anchoredCard.height) * transform.scale;

          let left: number;
          let top: number;
          let arrowSide: 'left' | 'right' | 'top';

          if (isNarrow) {
            left = cardLeftX + (anchoredCard.width * transform.scale - popWidth) / 2;
            top = cardBottomY + 12;
            arrowSide = 'top';
          } else {
            const fitsRight = cardRightX + 14 + popWidth <= viewportSize.width - 12;
            if (fitsRight) {
              left = cardRightX + 14;
              arrowSide = 'left';
            } else {
              left = cardLeftX - popWidth - 14;
              arrowSide = 'right';
            }
            top = cardTopY - 16;
          }

          return (
            <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
              <div
                style={{
                  transform: `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`,
                }}
                className="pointer-events-auto absolute top-0 left-0 will-change-transform"
              >
                {/* Pointer Arrow pointing straight at the member card */}
                {arrowSide === 'left' && (
                  <div
                    style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                    className="w-3 h-3 rotate-45 border-l border-b absolute -left-1.5 top-7 z-10"
                  />
                )}
                {arrowSide === 'right' && (
                  <div
                    style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                    className="w-3 h-3 rotate-45 border-r border-t absolute -right-1.5 top-7 z-10"
                  />
                )}
                {arrowSide === 'top' && (
                  <div
                    style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                    className="w-3 h-3 rotate-45 border-l border-t absolute left-1/2 -translate-x-1/2 -top-1.5 z-10"
                  />
                )}
                {previewPopover}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }
);

TreeCanvas.displayName = 'TreeCanvas';
