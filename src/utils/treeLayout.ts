import { CardStyle, FamilyTreeData, Person, SpouseStatus, TreeOrientation } from '../types/family';
import { compareBirthDates } from './dateUtils';

export interface LayoutConfig {
  cardWidth: number;
  cardHeight: number;
  spouseGap: number;
  siblingGap: number;
  generationGap: number;
  forestGap: number;
}

export function getLayoutConfig(cardStyle: CardStyle, orientation: TreeOrientation): LayoutConfig {
  if (orientation === 'left-right') {
    if (cardStyle === 'photo-only') {
      return {
        cardWidth: 158,
        cardHeight: 54,
        spouseGap: 18,
        siblingGap: 14,
        generationGap: 68,
        forestGap: 54,
      };
    }
    if (cardStyle === 'compact') {
      return {
        cardWidth: 180,
        cardHeight: 68,
        spouseGap: 20,
        siblingGap: 16,
        generationGap: 72,
        forestGap: 60,
      };
    }
    return {
      cardWidth: 214,
      cardHeight: 96,
      spouseGap: 24,
      siblingGap: 22,
      generationGap: 84,
      forestGap: 72,
    };
  }

  // Vertical trees (top-down & bottom-up)
  if (cardStyle === 'photo-only') {
    return {
      cardWidth: 112,
      cardHeight: 116,
      spouseGap: 24,
      siblingGap: 18,
      generationGap: 68,
      forestGap: 68,
    };
  }
  if (cardStyle === 'compact') {
    return {
      cardWidth: 166,
      cardHeight: 74,
      spouseGap: 22,
      siblingGap: 20,
      generationGap: 60,
      forestGap: 72,
    };
  }
  return {
    cardWidth: 212,
    cardHeight: 108,
    spouseGap: 28,
    siblingGap: 30,
    generationGap: 78,
    forestGap: 92,
  };
}

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
  orientation: TreeOrientation;
  cardStyle: CardStyle;
}

interface FamilyUnit {
  id: string;
  primaryId: string;
  spouseIds: string[];
  children: FamilyUnit[];
  generation: number;
  coupleBreadth: number;  // width for vertical trees, height for left-right trees
  subtreeBreadth: number;
  breadthStart: number;   // x for vertical trees, y for left-right trees
  coupleStart: number;    // coupleX for vertical trees, coupleY for left-right trees
  depthPos: number;       // y for vertical trees, x for left-right trees
  hasChildren: boolean;
  isCollapsed: boolean;
  hiddenDescendantCount: number;
}

function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => {
    if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
      return a.birthOrder - b.birthOrder;
    }
    if (a.birthOrder != null && b.birthOrder == null) return -1;
    if (a.birthOrder == null && b.birthOrder != null) return 1;
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
 * Compute clean, zero-overlap layout for a large extended family tree supporting:
 * - 3 card styles: 'detailed', 'compact', 'photo-only'
 * - 3 orientations: 'top-down', 'bottom-up' (growing tree from roots up), 'left-right' (vertical sibling stacks!)
 * - collapse/expand subtrees, focus root, and multi-root forests.
 */
export function computeFamilyTreeLayout(
  data: FamilyTreeData,
  options: {
    cardStyle?: CardStyle;
    compact?: boolean; // legacy shorthand
    orientation?: TreeOrientation;
    collapsedIds?: Set<string>;
    focusRootId?: string | null;
  } = {}
): TreeLayoutResult {
  const cardStyle: CardStyle =
    options.cardStyle ?? (options.compact ? 'compact' : 'detailed');
  const orientation: TreeOrientation = options.orientation ?? 'top-down';
  const cfg = getLayoutConfig(cardStyle, orientation);
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
      orientation,
      cardStyle,
    };
  }

  const isHorizontalFlow = orientation === 'left-right';
  const unitItemBreadth = isHorizontalFlow ? cfg.cardHeight : cfg.cardWidth;
  const unitItemDepth = isHorizontalFlow ? cfg.cardWidth : cfg.cardHeight;

  const getChildrenOfUnit = (parentIds: string[], alreadyPlaced: Set<string>): Person[] => {
    const pSet = new Set(parentIds);
    const matched = allMembers.filter(
      (m) => !alreadyPlaced.has(m.id) && m.parentIds.some((pid) => pSet.has(pid))
    );
    return sortPeople(matched);
  };

  const placed = new Set<string>();
  const rootUnits: FamilyUnit[] = [];

  const buildUnit = (primaryId: string, generation: number): FamilyUnit | null => {
    const primary = members[primaryId];
    if (!primary || placed.has(primaryId)) return null;
    placed.add(primaryId);

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

    const childUnits: FamilyUnit[] = [];
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
    const coupleBreadth =
      memberCount * unitItemBreadth + Math.max(0, memberCount - 1) * cfg.spouseGap;

    return {
      id: `unit_${primaryId}`,
      primaryId,
      spouseIds: attachedSpouses,
      children: childUnits,
      generation,
      coupleBreadth,
      subtreeBreadth: coupleBreadth,
      breadthStart: 0,
      coupleStart: 0,
      depthPos: 0,
      hasChildren,
      isCollapsed,
      hiddenDescendantCount,
    };
  };

  if (options.focusRootId && members[options.focusRootId]) {
    const focused = buildUnit(options.focusRootId, 1);
    if (focused) rootUnits.push(focused);
  } else {
    const candidateRoots: Person[] = [];
    if (data.rootPersonId && members[data.rootPersonId]) {
      let top = members[data.rootPersonId];
      const seen = new Set<string>([top.id]);
      while (top.parentIds.length > 0) {
        const nextParent = members[top.parentIds[0]];
        if (!nextParent || seen.has(nextParent.id)) break;
        seen.add(nextParent.id);
        top = nextParent;
      }
      candidateRoots.push(top);
    }

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

    for (const m of sortPeople(allMembers)) {
      if (!placed.has(m.id)) {
        const unit = buildUnit(m.id, 1);
        if (unit) rootUnits.push(unit);
      }
    }
  }

  // Bottom-up pass: measure subtree breadth
  const measureSubtree = (unit: FamilyUnit): number => {
    if (unit.children.length === 0) {
      unit.subtreeBreadth = unit.coupleBreadth;
      return unit.subtreeBreadth;
    }
    let childrenTotal = 0;
    for (let i = 0; i < unit.children.length; i++) {
      childrenTotal += measureSubtree(unit.children[i]);
      if (i > 0) childrenTotal += cfg.siblingGap;
    }
    unit.subtreeBreadth = Math.max(unit.coupleBreadth, childrenTotal);
    return unit.subtreeBreadth;
  };

  for (const root of rootUnits) {
    measureSubtree(root);
  }

  const PADDING_X = 80;
  const PADDING_Y = 72;
  let maxGeneration = 1;
  let maxDepth = 0;
  let maxBreadth = 0;

  // Assign abstract (breadth, depth) positions first
  const assignAbstractPositions = (unit: FamilyUnit, breadthStart: number, depthPos: number) => {
    unit.breadthStart = breadthStart;
    unit.depthPos = depthPos;
    unit.coupleStart = breadthStart + (unit.subtreeBreadth - unit.coupleBreadth) / 2;
    maxGeneration = Math.max(maxGeneration, unit.generation);
    maxDepth = Math.max(maxDepth, depthPos + unitItemDepth);
    maxBreadth = Math.max(maxBreadth, breadthStart + unit.subtreeBreadth);

    if (unit.children.length > 0) {
      const nextDepth = depthPos + unitItemDepth + cfg.generationGap;
      let totalChildrenB = 0;
      for (let i = 0; i < unit.children.length; i++) {
        totalChildrenB += unit.children[i].subtreeBreadth;
        if (i > 0) totalChildrenB += cfg.siblingGap;
      }
      let cursor = breadthStart + (unit.subtreeBreadth - totalChildrenB) / 2;
      for (const childUnit of unit.children) {
        assignAbstractPositions(childUnit, cursor, nextDepth);
        cursor += childUnit.subtreeBreadth + cfg.siblingGap;
      }
    }
  };

  let forestCursor = isHorizontalFlow ? PADDING_Y : PADDING_X;
  const initialDepth = isHorizontalFlow ? PADDING_X : PADDING_Y;
  for (const root of rootUnits) {
    assignAbstractPositions(root, forestCursor, initialDepth);
    forestCursor += root.subtreeBreadth + cfg.forestGap;
  }

  const totalWidth = isHorizontalFlow
    ? Math.max(820, maxDepth + PADDING_X + 40)
    : Math.max(820, maxBreadth + PADDING_X);
  const totalHeight = isHorizontalFlow
    ? Math.max(540, maxBreadth + PADDING_Y + 40)
    : Math.max(540, maxDepth + PADDING_Y + 40);

  const cards: PositionedCard[] = [];
  const marriageConnectors: MarriageConnector[] = [];
  const parentChildConnectors: ParentChildConnector[] = [];
  const generationMap: Record<string, number> = {};

  const mapCardCoords = (breadthPos: number, depthPos: number): { x: number; y: number } => {
    if (orientation === 'left-right') {
      return { x: depthPos, y: breadthPos };
    }
    if (orientation === 'bottom-up') {
      return { x: breadthPos, y: totalHeight - (depthPos + cfg.cardHeight) };
    }
    return { x: breadthPos, y: depthPos };
  };

  const emitUnit = (unit: FamilyUnit) => {
    const primary = members[unit.primaryId];
    const allUnitIds = [unit.primaryId, ...unit.spouseIds];

    allUnitIds.forEach((pid, idx) => {
      const person = members[pid];
      const itemBreadth = unit.coupleStart + idx * (unitItemBreadth + cfg.spouseGap);
      const { x: cx, y: cy } = mapCardCoords(itemBreadth, unit.depthPos);

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

      if (idx > 0) {
        const prevBreadth = unit.coupleStart + (idx - 1) * (unitItemBreadth + cfg.spouseGap);
        const prevPos = mapCardCoords(prevBreadth, unit.depthPos);
        const spouseLink = primary.spouses.find((s) => s.spouseId === pid);

        if (orientation === 'left-right') {
          marriageConnectors.push({
            id: `mar_${unit.primaryId}_${pid}`,
            personAId: allUnitIds[idx - 1],
            personBId: pid,
            x1: prevPos.x + cfg.cardWidth / 2,
            y1: prevPos.y + cfg.cardHeight,
            x2: cx + cfg.cardWidth / 2,
            y2: cy,
            status: spouseLink?.status ?? 'married',
          });
        } else {
          marriageConnectors.push({
            id: `mar_${unit.primaryId}_${pid}`,
            personAId: allUnitIds[idx - 1],
            personBId: pid,
            x1: prevPos.x + cfg.cardWidth,
            y1: cy + cfg.cardHeight / 2,
            x2: cx,
            y2: cy + cfg.cardHeight / 2,
            status: spouseLink?.status ?? 'married',
          });
        }
      }
    });

    if (unit.children.length > 0) {
      const primaryPos = mapCardCoords(unit.coupleStart, unit.depthPos);

      for (const childUnit of unit.children) {
        emitUnit(childUnit);
        const childPos = mapCardCoords(childUnit.coupleStart, childUnit.depthPos);

        if (orientation === 'left-right') {
          // Horizontal flow: Left parent -> Right children stacked vertically
          const anchorX =
            unit.spouseIds.length >= 1
              ? primaryPos.x + cfg.cardWidth / 2
              : primaryPos.x + cfg.cardWidth;
          const anchorY =
            unit.spouseIds.length >= 1
              ? primaryPos.y + cfg.cardHeight + cfg.spouseGap / 2
              : primaryPos.y + cfg.cardHeight / 2;

          const busX = primaryPos.x + cfg.cardWidth + cfg.generationGap * 0.48;
          const targetX = childPos.x;
          const targetY = childPos.y + cfg.cardHeight / 2;

          const r = 10;
          let path: string;
          if (Math.abs(targetY - anchorY) < 2) {
            path = `M ${anchorX} ${anchorY} L ${targetX} ${targetY}`;
          } else {
            const dir = targetY > anchorY ? 1 : -1;
            const cr1 = Math.min(r, Math.abs(targetY - anchorY) / 2, Math.max(2, (busX - anchorX) / 2));
            const cr2 = Math.min(r, Math.abs(targetY - anchorY) / 2, Math.max(2, (targetX - busX) / 2));
            path = [
              `M ${anchorX} ${anchorY}`,
              `L ${busX - cr1} ${anchorY}`,
              `Q ${busX} ${anchorY} ${busX} ${anchorY + dir * cr1}`,
              `L ${busX} ${targetY - dir * cr2}`,
              `Q ${busX} ${targetY} ${busX + cr2} ${targetY}`,
              `L ${targetX} ${targetY}`,
            ].join(' ');
          }

          parentChildConnectors.push({
            id: `pc_${unit.id}_${childUnit.primaryId}`,
            parentIds: allUnitIds,
            childId: childUnit.primaryId,
            path,
            midX: busX,
            midY: (anchorY + targetY) / 2,
          });
        } else if (orientation === 'bottom-up') {
          // Bottom-up growing tree: Parent below -> Children above
          const anchorX =
            unit.spouseIds.length >= 1
              ? primaryPos.x + cfg.cardWidth + cfg.spouseGap / 2
              : primaryPos.x + cfg.cardWidth / 2;
          const anchorY =
            unit.spouseIds.length >= 1
              ? primaryPos.y + cfg.cardHeight / 2
              : primaryPos.y;

          const busY = primaryPos.y - cfg.generationGap * 0.48;
          const childPrimaryX = childPos.x + cfg.cardWidth / 2;
          const childBottomY = childPos.y + cfg.cardHeight;

          const r = 10;
          let path: string;
          if (Math.abs(childPrimaryX - anchorX) < 2) {
            path = `M ${anchorX} ${anchorY} L ${childPrimaryX} ${childBottomY}`;
          } else {
            const dir = childPrimaryX > anchorX ? 1 : -1;
            const cr1 = Math.min(r, Math.abs(childPrimaryX - anchorX) / 2, Math.max(2, (anchorY - busY) / 2));
            const cr2 = Math.min(r, Math.abs(childPrimaryX - anchorX) / 2, Math.max(2, (busY - childBottomY) / 2));
            path = [
              `M ${anchorX} ${anchorY}`,
              `L ${anchorX} ${busY + cr1}`,
              `Q ${anchorX} ${busY} ${anchorX + dir * cr1} ${busY}`,
              `L ${childPrimaryX - dir * cr2} ${busY}`,
              `Q ${childPrimaryX} ${busY} ${childPrimaryX} ${busY - cr2}`,
              `L ${childPrimaryX} ${childBottomY}`,
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
        } else {
          // Classic Top-Down
          const anchorX =
            unit.spouseIds.length >= 1
              ? primaryPos.x + cfg.cardWidth + cfg.spouseGap / 2
              : primaryPos.x + cfg.cardWidth / 2;
          const anchorY =
            unit.spouseIds.length >= 1
              ? primaryPos.y + cfg.cardHeight / 2
              : primaryPos.y + cfg.cardHeight;

          const busY = primaryPos.y + cfg.cardHeight + cfg.generationGap * 0.48;
          const childPrimaryX = childPos.x + cfg.cardWidth / 2;
          const childTopY = childPos.y;

          const r = 10;
          let path: string;
          if (Math.abs(childPrimaryX - anchorX) < 2) {
            path = `M ${anchorX} ${anchorY} L ${childPrimaryX} ${childTopY}`;
          } else {
            const dir = childPrimaryX > anchorX ? 1 : -1;
            const cr1 = Math.min(r, Math.abs(childPrimaryX - anchorX) / 2, Math.max(2, (busY - anchorY) / 2));
            const cr2 = Math.min(r, Math.abs(childPrimaryX - anchorX) / 2, Math.max(2, (childTopY - busY) / 2));
            path = [
              `M ${anchorX} ${anchorY}`,
              `L ${anchorX} ${busY - cr1}`,
              `Q ${anchorX} ${busY} ${anchorX + dir * cr1} ${busY}`,
              `L ${childPrimaryX - dir * cr2} ${busY}`,
              `Q ${childPrimaryX} ${busY} ${childPrimaryX} ${busY + cr2}`,
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
        }
      }
    }
  };

  for (const root of rootUnits) {
    emitUnit(root);
  }

  return {
    cards,
    marriageConnectors,
    parentChildConnectors,
    width: totalWidth,
    height: totalHeight,
    maxGeneration,
    generationMap,
    orientation,
    cardStyle,
  };
}
