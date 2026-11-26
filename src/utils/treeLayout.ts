import { FamilyTreeData, Person, SpouseStatus } from '../types/family';
import { compareBirthDates } from './dateUtils';

export interface LayoutConfig {
  cardWidth: number;
  cardHeight: number;
  spouseGap: number;
  siblingGap: number;
  generationGap: number;
  forestGap: number;
}

export const NORMAL_LAYOUT: LayoutConfig = {
  cardWidth: 212,
  cardHeight: 108,
  spouseGap: 28,
  siblingGap: 34,
  generationGap: 78,
  forestGap: 96,
};

export const COMPACT_LAYOUT: LayoutConfig = {
  cardWidth: 168,
  cardHeight: 74,
  spouseGap: 20,
  siblingGap: 22,
  generationGap: 58,
  forestGap: 72,
};

export interface PositionedCard {
  person: Person;
  x: number;
  y: number;
  width: number;
  height: number;
  generation: number;
  isSpouseInUnit: boolean;
  unitId: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  hiddenDescendantCount: number;
}

export interface MarriageConnector {
  id: string;
  personAId: string;
  personBId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  status: SpouseStatus;
}

export interface ParentChildConnector {
  id: string;
  parentIds: string[];
  childId: string;
  path: string;
  midX: number;
  midY: number;
}

export interface TreeLayoutResult {
  cards: PositionedCard[];
  marriageConnectors: MarriageConnector[];
  parentChildConnectors: ParentChildConnector[];
  width: number;
  height: number;
  maxGeneration: number;
  generationMap: Record<string, number>;
}

interface FamilyUnit {
  id: string;
  primaryId: string;
  spouseIds: string[];
  children: FamilyUnit[];
  generation: number;
  coupleWidth: number;
  subtreeWidth: number;
  x: number; // left of subtree
  coupleX: number; // left of couple block
  y: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  hiddenDescendantCount: number;
}

function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => {
    if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
      return a.birthOrder - b.birthOrder;
    }
    const cmp = compareBirthDates(a.birthDate, b.birthDate);
    if (cmp !== 0) return cmp;
    return a.firstName.localeCompare(b.firstName, 'th');
  });
}

function countAllDescendants(
  members: Record<string, Person>,
  unitPrimaryId: string,
  spouseIds: string[],
  visited = new Set<string>()
): number {
  const parentSet = new Set([unitPrimaryId, ...spouseIds]);
  let count = 0;
  for (const m of Object.values(members)) {
    if (visited.has(m.id)) continue;
    if (m.parentIds.some((pid) => parentSet.has(pid))) {
      visited.add(m.id);
      count += 1;
      const mSpouses = m.spouses.map((s) => s.spouseId).filter((id) => members[id]);
      for (const sid of mSpouses) {
        if (!visited.has(sid)) {
          visited.add(sid);
          count += 1;
        }
      }
      count += countAllDescendants(members, m.id, mSpouses, visited);
    }
  }
  return count;
}

/**
 * Compute clean, zero-overlap layout for a large extended family tree (supporting spouses,
 * multiple generations, collapse/expand, focus subtree, and disconnected clusters).
 */
export function computeFamilyTreeLayout(
  data: FamilyTreeData,
  options: {
    compact?: boolean;
    collapsedIds?: Set<string>;
    focusRootId?: string | null;
  } = {}
): TreeLayoutResult {
  const cfg = options.compact ? COMPACT_LAYOUT : NORMAL_LAYOUT;
  const collapsedIds = options.collapsedIds ?? new Set<string>();
  const members = data.members;
  const allMembers = Object.values(members);

  if (allMembers.length === 0) {
    return {
      cards: [],
      marriageConnectors: [],
      parentChildConnectors: [],
      width: 800,
      height: 500,
      maxGeneration: 0,
      generationMap: {},
    };
  }

  // Helper: get children of any set of parent IDs
  const getChildrenOfUnit = (parentIds: string[], alreadyPlaced: Set<string>): Person[] => {
    const pSet = new Set(parentIds);
    const matched = allMembers.filter(
      (m) => !alreadyPlaced.has(m.id) && m.parentIds.some((pid) => pSet.has(pid))
    );
    return sortPeople(matched);
  };

  // Determine ordered root candidates
  const placed = new Set<string>();
  const rootUnits: FamilyUnit[] = [];

  const buildUnit = (primaryId: string, generation: number): FamilyUnit | null => {
    const primary = members[primaryId];
    if (!primary || placed.has(primaryId)) return null;
    placed.add(primaryId);

    // Attach spouses who haven't been placed yet
    const attachedSpouses: string[] = [];
    for (const sp of primary.spouses) {
      if (members[sp.spouseId] && !placed.has(sp.spouseId)) {
        placed.add(sp.spouseId);
        attachedSpouses.push(sp.spouseId);
      }
    }

    const unitParentIds = [primaryId, ...attachedSpouses];
    const directChildren = getChildrenOfUnit(unitParentIds, placed);
    const hasChildren = directChildren.length > 0;
    const isCollapsed = hasChildren && collapsedIds.has(primaryId);

    let childUnits: FamilyUnit[] = [];
    let hiddenDescendantCount = 0;

    if (isCollapsed) {
      hiddenDescendantCount = countAllDescendants(members, primaryId, attachedSpouses);
    } else if (hasChildren) {
      for (const child of directChildren) {
        const childUnit = buildUnit(child.id, generation + 1);
        if (childUnit) childUnits.push(childUnit);
      }
    }

    const memberCount = 1 + attachedSpouses.length;
    const coupleWidth = memberCount * cfg.cardWidth + Math.max(0, memberCount - 1) * cfg.spouseGap;

    return {
      id: `unit_${primaryId}`,
      primaryId,
      spouseIds: attachedSpouses,
      children: childUnits,
      generation,
      coupleWidth,
      subtreeWidth: coupleWidth,
      x: 0,
      coupleX: 0,
      y: 0,
      hasChildren,
      isCollapsed,
      hiddenDescendantCount,
    };
  };

  if (options.focusRootId && members[options.focusRootId]) {
    const focused = buildUnit(options.focusRootId, 1);
    if (focused) rootUnits.push(focused);
  } else {
    // 1. Prioritize designated rootPersonId if valid and has no parents
    const candidateRoots: Person[] = [];
    if (data.rootPersonId && members[data.rootPersonId]) {
      const rootP = members[data.rootPersonId];
      // Walk up to top ancestor if rootPersonId later got parents added
      let top = rootP;
      const seen = new Set<string>([top.id]);
      while (top.parentIds.length > 0) {
        const nextParent = members[top.parentIds[0]];
        if (!nextParent || seen.has(nextParent.id)) break;
        seen.add(nextParent.id);
        top = nextParent;
      }
      candidateRoots.push(top);
    }

    // 2. Find true top-level ancestors: people with no parents whose spouse does NOT have parents
    // (Spouses who married into the family will be attached beside their partner instead of starting a separate root!)
    const noParentMembers = sortPeople(allMembers.filter((m) => m.parentIds.length === 0));
    const trueRoots = noParentMembers.filter((m) => {
      const spouseHasParents = m.spouses.some(
        (s) => members[s.spouseId] && members[s.spouseId].parentIds.length > 0
      );
      return !spouseHasParents;
    });

    for (const r of trueRoots) {
      if (!candidateRoots.some((c) => c.id === r.id)) {
        candidateRoots.push(r);
      }
    }

    for (const root of candidateRoots) {
      if (!placed.has(root.id)) {
        const unit = buildUnit(root.id, 1);
        if (unit) rootUnits.push(unit);
      }
    }

    // 3. Safety net: any remaining unplaced members (e.g., isolated or unusual graph)
    for (const m of sortPeople(allMembers)) {
      if (!placed.has(m.id)) {
        const unit = buildUnit(m.id, 1);
        if (unit) rootUnits.push(unit);
      }
    }
  }

  // Bottom-up pass: measure subtree widths
  const measureSubtree = (unit: FamilyUnit): number => {
    if (unit.children.length === 0) {
      unit.subtreeWidth = unit.coupleWidth;
      return unit.subtreeWidth;
    }
    let childrenTotalWidth = 0;
    for (let i = 0; i < unit.children.length; i++) {
      childrenTotalWidth += measureSubtree(unit.children[i]);
      if (i > 0) childrenTotalWidth += cfg.siblingGap;
    }
    unit.subtreeWidth = Math.max(unit.coupleWidth, childrenTotalWidth);
    return unit.subtreeWidth;
  };

  for (const root of rootUnits) {
    measureSubtree(root);
  }

  // Top-down pass: assign coordinates
  const PADDING_X = 80;
  const PADDING_Y = 64;
  const cards: PositionedCard[] = [];
  const marriageConnectors: MarriageConnector[] = [];
  const parentChildConnectors: ParentChildConnector[] = [];
  const generationMap: Record<string, number> = {};
  let maxGeneration = 1;
  let maxRight = 0;
  let maxBottom = 0;

  const positionUnit = (unit: FamilyUnit, leftX: number, topY: number) => {
    unit.x = leftX;
    unit.y = topY;
    unit.coupleX = leftX + (unit.subtreeWidth - unit.coupleWidth) / 2;
    maxGeneration = Math.max(maxGeneration, unit.generation);

    const primary = members[unit.primaryId];
    const allUnitIds = [unit.primaryId, ...unit.spouseIds];

    allUnitIds.forEach((pid, idx) => {
      const person = members[pid];
      const cx = unit.coupleX + idx * (cfg.cardWidth + cfg.spouseGap);
      const cy = topY;
      generationMap[pid] = unit.generation;
      cards.push({
        person,
        x: cx,
        y: cy,
        width: cfg.cardWidth,
        height: cfg.cardHeight,
        generation: unit.generation,
        isSpouseInUnit: idx > 0,
        unitId: unit.id,
        hasChildren: idx === 0 && unit.hasChildren,
        isCollapsed: idx === 0 && unit.isCollapsed,
        hiddenDescendantCount: idx === 0 ? unit.hiddenDescendantCount : 0,
      });
      maxRight = Math.max(maxRight, cx + cfg.cardWidth);
      maxBottom = Math.max(maxBottom, cy + cfg.cardHeight);

      // Marriage connector between adjacent couple cards
      if (idx > 0) {
        const prevX = unit.coupleX + (idx - 1) * (cfg.cardWidth + cfg.spouseGap);
        const spouseLink = primary.spouses.find((s) => s.spouseId === pid);
        marriageConnectors.push({
          id: `mar_${unit.primaryId}_${pid}`,
          personAId: allUnitIds[idx - 1],
          personBId: pid,
          x1: prevX + cfg.cardWidth,
          y1: cy + cfg.cardHeight / 2,
          x2: cx,
          y2: cy + cfg.cardHeight / 2,
          status: spouseLink?.status ?? 'married',
        });
      }
    });

    if (unit.children.length > 0) {
      // Origin point for children connectors: center of couple block (or between first two spouses)
      const anchorX =
        unit.spouseIds.length >= 1
          ? unit.coupleX + cfg.cardWidth + cfg.spouseGap / 2
          : unit.coupleX + cfg.cardWidth / 2;
      const anchorY =
        unit.spouseIds.length >= 1
          ? topY + cfg.cardHeight / 2
          : topY + cfg.cardHeight;

      const childrenRowY = topY + cfg.cardHeight + cfg.generationGap;
      const busY = topY + cfg.cardHeight + cfg.generationGap * 0.48;

      // Center children block under unit.subtreeWidth
      let totalChildrenW = 0;
      for (let i = 0; i < unit.children.length; i++) {
        totalChildrenW += unit.children[i].subtreeWidth;
        if (i > 0) totalChildrenW += cfg.siblingGap;
      }
      let cursorX = leftX + (unit.subtreeWidth - totalChildrenW) / 2;

      for (const childUnit of unit.children) {
        positionUnit(childUnit, cursorX, childrenRowY);

        // Child target X: center of child's primary card
        const childPrimaryX = childUnit.coupleX + cfg.cardWidth / 2;
        const childTopY = childrenRowY;

        // Smooth orthogonal SVG path with subtle rounded corners
        const r = 10;
        let path: string;
        if (Math.abs(childPrimaryX - anchorX) < 2) {
          path = `M ${anchorX} ${anchorY} L ${childPrimaryX} ${childTopY}`;
        } else {
          const dir = childPrimaryX > anchorX ? 1 : -1;
          const cornerR = Math.min(r, Math.abs(childPrimaryX - anchorX) / 2, (busY - anchorY) / 2);
          const cornerR2 = Math.min(r, Math.abs(childPrimaryX - anchorX) / 2, (childTopY - busY) / 2);
          path = [
            `M ${anchorX} ${anchorY}`,
            `L ${anchorX} ${busY - cornerR}`,
            `Q ${anchorX} ${busY} ${anchorX + dir * cornerR} ${busY}`,
            `L ${childPrimaryX - dir * cornerR2} ${busY}`,
            `Q ${childPrimaryX} ${busY} ${childPrimaryX} ${busY + cornerR2}`,
            `L ${childPrimaryX} ${childTopY}`,
          ].join(' ');
        }

        parentChildConnectors.push({
          id: `pc_${unit.id}_${childUnit.primaryId}`,
          parentIds: allUnitIds,
          childId: childUnit.primaryId,
          path,
          midX: (anchorX + childPrimaryX) / 2,
          midY: busY,
        });

        cursorX += childUnit.subtreeWidth + cfg.siblingGap;
      }
    }
  };

  let forestCursorX = PADDING_X;
  for (const root of rootUnits) {
    positionUnit(root, forestCursorX, PADDING_Y);
    forestCursorX += root.subtreeWidth + cfg.forestGap;
  }

  return {
    cards,
    marriageConnectors,
    parentChildConnectors,
    width: Math.max(800, maxRight + PADDING_X),
    height: Math.max(520, maxBottom + PADDING_Y + 40),
    maxGeneration,
    generationMap,
  };
}
