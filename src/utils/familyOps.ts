import { FamilyTreeData, Gender, Person, SpouseStatus } from '../types/family';
import { compareBirthDates } from './dateUtils';

export function generateId(prefix = 'p'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getFullName(person: Person): string {
  const parts = [person.title, person.firstName, person.lastName].filter(Boolean);
  return parts.join(' ').trim() || 'ไม่ระบุชื่อ';
}

export function getDisplayNameWithNickname(person: Person): string {
  const full = `${person.firstName} ${person.lastName}`.trim();
  return person.nickname ? `${full} (${person.nickname})` : full;
}

export function getChildrenOf(members: Record<string, Person>, personId: string): Person[] {
  return Object.values(members)
    .filter((m) => m.parentIds.includes(personId))
    .sort((a, b) => {
      if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
        return a.birthOrder - b.birthOrder;
      }
      const dateCmp = compareBirthDates(a.birthDate, b.birthDate);
      if (dateCmp !== 0) return dateCmp;
      return a.firstName.localeCompare(b.firstName, 'th');
    });
}

export function getSiblingsOf(members: Record<string, Person>, personId: string): Person[] {
  const person = members[personId];
  if (!person || person.parentIds.length === 0) return [];
  const parentSet = new Set(person.parentIds);
  return Object.values(members)
    .filter((m) => m.id !== personId && m.parentIds.some((pid) => parentSet.has(pid)))
    .sort((a, b) => {
      if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
        return a.birthOrder - b.birthOrder;
      }
      const dateCmp = compareBirthDates(a.birthDate, b.birthDate);
      if (dateCmp !== 0) return dateCmp;
      return a.firstName.localeCompare(b.firstName, 'th');
    });
}

/**
 * Returns true if candidateAncestorId is already an ancestor of targetId (or equal)
 */
export function isAncestorOrSelf(
  members: Record<string, Person>,
  candidateAncestorId: string,
  targetId: string
): boolean {
  if (candidateAncestorId === targetId) return true;
  const visited = new Set<string>();
  const queue: string[] = [targetId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    const p = members[curr];
    if (!p) continue;
    for (const pid of p.parentIds) {
      if (pid === candidateAncestorId) return true;
      if (!visited.has(pid)) queue.push(pid);
    }
  }
  return false;
}

export function createBlankPerson(partial: Partial<Person> = {}): Person {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    firstName: partial.firstName ?? '',
    lastName: partial.lastName ?? '',
    gender: partial.gender ?? 'male',
    isDeceased: partial.isDeceased ?? false,
    parentIds: partial.parentIds ?? [],
    spouses: partial.spouses ?? [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function upsertPerson(data: FamilyTreeData, person: Person): FamilyTreeData {
  const now = new Date().toISOString();
  return {
    ...data,
    updatedAt: now,
    members: {
      ...data.members,
      [person.id]: {
        ...person,
        updatedAt: now,
      },
    },
  };
}

/**
 * Safely link parentId -> childId (preventing cycles and duplicate/over-2 parents)
 */
export function linkParentChild(
  data: FamilyTreeData,
  parentId: string,
  childId: string
): { data: FamilyTreeData; error?: string } {
  const parent = data.members[parentId];
  const child = data.members[childId];
  if (!parent || !child) return { data, error: 'ไม่พบข้อมูลสมาชิก' };
  if (parentId === childId) return { data, error: 'ไม่สามารถเชื่อมโยงกับตัวเองได้' };
  if (child.parentIds.includes(parentId)) return { data };
  if (child.parentIds.length >= 2) {
    return { data, error: 'สมาชิกคนนี้มีข้อมูลพ่อแม่ครบ 2 คนแล้ว กรุณายกเลิกคนเดิมก่อน' };
  }
  // Check cycle: child cannot be an ancestor of parent
  if (isAncestorOrSelf(data.members, childId, parentId)) {
    return { data, error: 'ไม่สามารถเชื่อมโยงได้ เพราะจะทำให้เกิดวงจรบรรพบุรุษซ้อนทับ' };
  }

  const now = new Date().toISOString();
  const updatedChild: Person = {
    ...child,
    parentIds: [...child.parentIds, parentId],
    updatedAt: now,
  };

  return {
    data: {
      ...data,
      updatedAt: now,
      members: {
        ...data.members,
        [childId]: updatedChild,
      },
    },
  };
}

export function unlinkParentChild(
  data: FamilyTreeData,
  parentId: string,
  childId: string
): FamilyTreeData {
  const child = data.members[childId];
  if (!child) return data;
  const now = new Date().toISOString();
  return {
    ...data,
    updatedAt: now,
    members: {
      ...data.members,
      [childId]: {
        ...child,
        parentIds: child.parentIds.filter((id) => id !== parentId),
        updatedAt: now,
      },
    },
  };
}

export function linkSpouses(
  data: FamilyTreeData,
  personAId: string,
  personBId: string,
  status: SpouseStatus = 'married',
  marriageDate?: string
): { data: FamilyTreeData; error?: string } {
  const a = data.members[personAId];
  const b = data.members[personBId];
  if (!a || !b) return { data, error: 'ไม่พบข้อมูลสมาชิก' };
  if (personAId === personBId) return { data, error: 'ไม่สามารถเชื่อมโยงกับตัวเองได้' };

  const now = new Date().toISOString();
  const aSpouses = a.spouses.filter((s) => s.spouseId !== personBId);
  const bSpouses = b.spouses.filter((s) => s.spouseId !== personAId);

  return {
    data: {
      ...data,
      updatedAt: now,
      members: {
        ...data.members,
        [personAId]: {
          ...a,
          spouses: [...aSpouses, { spouseId: personBId, status, marriageDate }],
          updatedAt: now,
        },
        [personBId]: {
          ...b,
          spouses: [...bSpouses, { spouseId: personAId, status, marriageDate }],
          updatedAt: now,
        },
      },
    },
  };
}

export function updateSpouseStatus(
  data: FamilyTreeData,
  personAId: string,
  personBId: string,
  status: SpouseStatus,
  marriageDate?: string
): FamilyTreeData {
  const res = linkSpouses(data, personAId, personBId, status, marriageDate);
  return res.data;
}

export function unlinkSpouses(
  data: FamilyTreeData,
  personAId: string,
  personBId: string
): FamilyTreeData {
  const a = data.members[personAId];
  const b = data.members[personBId];
  const now = new Date().toISOString();
  const nextMembers = { ...data.members };

  if (a) {
    nextMembers[personAId] = {
      ...a,
      spouses: a.spouses.filter((s) => s.spouseId !== personBId),
      updatedAt: now,
    };
  }
  if (b) {
    nextMembers[personBId] = {
      ...b,
      spouses: b.spouses.filter((s) => s.spouseId !== personAId),
      updatedAt: now,
    };
  }

  return {
    ...data,
    updatedAt: now,
    members: nextMembers,
  };
}

/**
 * Delete a person and cleanly remove all references from other members' parentIds and spouses.
 */
export function deletePerson(data: FamilyTreeData, personId: string): FamilyTreeData {
  const now = new Date().toISOString();
  const nextMembers: Record<string, Person> = {};

  for (const [id, member] of Object.entries(data.members)) {
    if (id === personId) continue;
    const cleanedParents = member.parentIds.filter((pid) => pid !== personId);
    const cleanedSpouses = member.spouses.filter((s) => s.spouseId !== personId);
    if (
      cleanedParents.length !== member.parentIds.length ||
      cleanedSpouses.length !== member.spouses.length
    ) {
      nextMembers[id] = {
        ...member,
        parentIds: cleanedParents,
        spouses: cleanedSpouses,
        updatedAt: now,
      };
    } else {
      nextMembers[id] = member;
    }
  }

  return {
    ...data,
    rootPersonId: data.rootPersonId === personId ? undefined : data.rootPersonId,
    updatedAt: now,
    members: nextMembers,
  };
}

export interface SiblingRankInfo {
  order: number;          // ลำดับคนที่ (1, 2, 3...)
  total: number;          // จำนวนพี่น้องทั้งหมดรวมตัวเอง
  isEldest: boolean;
  isYoungest: boolean;
  label: string;          // เช่น "บุตรคนที่ 1/3 (คนโต)"
  shortLabel: string;     // เช่น "คนที่ 1/3" หรือ "คนโต"
}

/**
 * Compute sibling birth order rank (using explicit birthOrder first, then birthDate).
 */
export function getSiblingRankInfo(
  members: Record<string, Person>,
  personId: string
): SiblingRankInfo | null {
  const person = members[personId];
  if (!person) return null;

  // Gather all siblings including self (anyone sharing at least one parent)
  if (person.parentIds.length > 0) {
    const parentSet = new Set(person.parentIds);
    const group = Object.values(members)
      .filter((m) => m.parentIds.some((pid) => parentSet.has(pid)))
      .sort((a, b) => {
        if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
          return a.birthOrder - b.birthOrder;
        }
        if (a.birthOrder != null && b.birthOrder == null) return -1;
        if (a.birthOrder == null && b.birthOrder != null) return 1;
        const cmp = compareBirthDates(a.birthDate, b.birthDate);
        if (cmp !== 0) return cmp;
        return a.firstName.localeCompare(b.firstName, 'th');
      });

    const idx = group.findIndex((m) => m.id === personId);
    if (idx === -1) return null;
    const total = group.length;
    const order = person.birthOrder ?? idx + 1;
    const isEldest = total > 1 && idx === 0;
    const isYoungest = total > 1 && idx === total - 1;

    if (total === 1 && person.birthOrder == null) {
      return {
        order: 1,
        total: 1,
        isEldest: false,
        isYoungest: false,
        label: 'บุตรคนเดียว',
        shortLabel: 'ลูกคนเดียว',
      };
    }

    const roleSuffix = isEldest ? ' · คนโต' : isYoungest ? ' · คนเล็ก' : '';
    return {
      order,
      total,
      isEldest,
      isYoungest,
      label: `คนที่ ${order}/${total}${roleSuffix}`,
      shortLabel: isEldest ? `คนที่ ${order} (โต)` : isYoungest ? `คนที่ ${order} (เล็ก)` : `คนที่ ${order}/${total}`,
    };
  }

  // Even without recorded parents, if user explicitly set birthOrder, show it!
  if (person.birthOrder != null) {
    return {
      order: person.birthOrder,
      total: person.birthOrder,
      isEldest: person.birthOrder === 1,
      isYoungest: false,
      label: `พี่น้องคนที่ ${person.birthOrder}`,
      shortLabel: `คนที่ ${person.birthOrder}`,
    };
  }

  return null;
}

export const FAMILY_COLOR_SWATCHES: string[] = [
  '#2E6254', // เขียวพฤกษา
  '#B5653B', // ดินเผาอบอุ่น
  '#2D5B88', // น้ำเงินคราม
  '#8E3B5B', // ทับทิมไวน์
  '#C27D28', // ทองอำพัน
  '#1F7A7A', // เขียวศิลาดล
  '#5B7A3B', // เขียวมะกอก
  '#6F4B8E', // ม่วงอัญชัน
  '#C85A4A', // แดงปะการัง
  '#3F5E96', // ฟ้ายีนส์เข้ม
  '#8A5A32', // น้ำตาลไม้สัก
  '#24748F', // น้ำทะเลลึก
];

/**
 * Deterministic distinct family color for any couple (or explicit custom color if set).
 */
export function getCoupleColor(
  personAId: string,
  personBId?: string,
  explicitColor?: string
): string {
  if (explicitColor && explicitColor.trim()) return explicitColor.trim();
  const key = personBId ? [personAId, personBId].sort().join('::') : personAId;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FAMILY_COLOR_SWATCHES[hash % FAMILY_COLOR_SWATCHES.length];
}

/**
 * Resolve the family color for a parent unit (couple or single parent).
 */
export function getUnitFamilyColor(
  members: Record<string, Person>,
  parentIds: string[]
): string {
  if (parentIds.length === 0) return FAMILY_COLOR_SWATCHES[0];
  const primary = members[parentIds[0]];
  if (!primary) return FAMILY_COLOR_SWATCHES[0];
  if (parentIds.length >= 2) {
    const partnerId = parentIds[1];
    const sp = primary.spouses.find((s) => s.spouseId === partnerId);
    const partnerSp = members[partnerId]?.spouses.find((s) => s.spouseId === primary.id);
    return getCoupleColor(primary.id, partnerId, sp?.color || partnerSp?.color);
  }
  // Single parent: if they have a spouse link with color, use it, else deterministic by parent ID
  if (primary.spouses.length > 0) {
    const firstSp = primary.spouses[0];
    return getCoupleColor(primary.id, firstSp.spouseId, firstSp.color);
  }
  return getCoupleColor(primary.id);
}

/**
 * Resolve the household/family color for a specific member:
 * - If they have parents, use their parents' family color (matches the branch line into their card!)
 * - Otherwise (root ancestor), use their own couple color (or deterministic color by ID)
 */
export function getMemberFamilyColor(
  members: Record<string, Person>,
  personId: string
): string {
  const person = members[personId];
  if (!person) return FAMILY_COLOR_SWATCHES[0];
  if (person.parentIds.length > 0) {
    return getUnitFamilyColor(members, person.parentIds);
  }
  if (person.spouses.length > 0) {
    const firstSp = person.spouses[0];
    const partnerSp = members[firstSp.spouseId]?.spouses.find((s) => s.spouseId === person.id);
    return getCoupleColor(person.id, firstSp.spouseId, firstSp.color || partnerSp?.color);
  }
  return getCoupleColor(person.id);
}

export interface CoupleUnitSummary {
  id: string;
  personA: Person;
  personB: Person;
  color: string;
  link: {
    status: SpouseStatus;
    familyName?: string;
    color?: string;
    marriageDate?: string;
    marriagePlace?: string;
    residence?: string;
    note?: string;
  };
  children: Person[];
}

/**
 * Aggregate all unique couples in the family tree along with their children & household details.
 */
export function getCoupleUnits(members: Record<string, Person>): CoupleUnitSummary[] {
  const seen = new Set<string>();
  const units: CoupleUnitSummary[] = [];

  for (const person of Object.values(members)) {
    for (const sp of person.spouses) {
      const partner = members[sp.spouseId];
      if (!partner) continue;
      const pairKey = [person.id, partner.id].sort().join('::');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const partnerSp = partner.spouses.find((s) => s.spouseId === person.id);

      const [first, second] =
        person.parentIds.length >= partner.parentIds.length
          ? [person, partner]
          : [partner, person];

      const children = Object.values(members)
        .filter((m) => m.parentIds.includes(first.id) || m.parentIds.includes(second.id))
        .filter((m) => {
          if (m.parentIds.length === 2) {
            return m.parentIds.includes(first.id) && m.parentIds.includes(second.id);
          }
          return true;
        })
        .sort((a, b) => {
          if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
            return a.birthOrder - b.birthOrder;
          }
          const cmp = compareBirthDates(a.birthDate, b.birthDate);
          if (cmp !== 0) return cmp;
          return a.firstName.localeCompare(b.firstName, 'th');
        });

      const explicitColor = sp.color || partnerSp?.color;
      units.push({
        id: pairKey,
        personA: first,
        personB: second,
        color: getCoupleColor(first.id, second.id, explicitColor),
        link: {
          status: sp.status || partnerSp?.status || 'married',
          familyName: sp.familyName || partnerSp?.familyName,
          color: explicitColor,
          marriageDate: sp.marriageDate || partnerSp?.marriageDate,
          marriagePlace: sp.marriagePlace || partnerSp?.marriagePlace,
          residence: sp.residence || partnerSp?.residence,
          note: sp.note || partnerSp?.note,
        },
        children,
      });
    }
  }

  return units;
}

/**
 * Update all household/couple details symmetrically on both spouses.
 */
export function updateSpouseDetails(
  data: FamilyTreeData,
  personAId: string,
  personBId: string,
  details: {
    status: SpouseStatus;
    familyName?: string;
    color?: string;
    marriageDate?: string;
    marriagePlace?: string;
    residence?: string;
    note?: string;
  }
): FamilyTreeData {
  const a = data.members[personAId];
  const b = data.members[personBId];
  if (!a || !b) return data;

  const now = new Date().toISOString();
  const cleanDetails = {
    status: details.status,
    familyName: details.familyName?.trim() || undefined,
    color: details.color?.trim() || undefined,
    marriageDate: details.marriageDate?.trim() || undefined,
    marriagePlace: details.marriagePlace?.trim() || undefined,
    residence: details.residence?.trim() || undefined,
    note: details.note?.trim() || undefined,
  };

  const updateList = (list: Person['spouses'], targetId: string) => {
    const exists = list.some((s) => s.spouseId === targetId);
    if (!exists) return [...list, { spouseId: targetId, ...cleanDetails }];
    return list.map((s) => (s.spouseId === targetId ? { ...s, ...cleanDetails } : s));
  };

  return {
    ...data,
    updatedAt: now,
    members: {
      ...data.members,
      [personAId]: {
        ...a,
        spouses: updateList(a.spouses, personBId),
        updatedAt: now,
      },
      [personBId]: {
        ...b,
        spouses: updateList(b.spouses, personAId),
        updatedAt: now,
      },
    },
  };
}

/**
 * Reorder siblings/children by assigning clean 1..N birthOrder values.
 */
export function reorderChildren(
  data: FamilyTreeData,
  orderedChildIds: string[]
): FamilyTreeData {
  const now = new Date().toISOString();
  const nextMembers = { ...data.members };
  orderedChildIds.forEach((cid, idx) => {
    const m = nextMembers[cid];
    if (m) {
      nextMembers[cid] = {
        ...m,
        birthOrder: idx + 1,
        updatedAt: now,
      };
    }
  });
  return {
    ...data,
    updatedAt: now,
    members: nextMembers,
  };
}

/**
 * Add a relative to an anchor person with smart defaults (surname, branch, partner co-parenting).
 */
export function addRelative(
  data: FamilyTreeData,
  anchorId: string,
  relation: 'child' | 'parent' | 'spouse' | 'sibling',
  fields: {
    firstName: string;
    lastName: string;
    nickname?: string;
    gender: Gender;
    photo?: string;
    birthDate?: string;
    birthOrder?: number;
    isDeceased?: boolean;
    deathDate?: string;
    occupation?: string;
    branch?: string;
    notes?: string;
    spouseStatus?: SpouseStatus;
    otherParentId?: string;
  }
): { data: FamilyTreeData; newPersonId: string; error?: string } {
  const anchor = data.members[anchorId];
  if (!anchor) {
    return { data, newPersonId: '', error: 'ไม่พบสมาชิกต้นทาง' };
  }

  const newPerson = createBlankPerson({
    firstName: fields.firstName.trim(),
    lastName: fields.lastName.trim(),
    nickname: fields.nickname?.trim() || undefined,
    gender: fields.gender,
    photo: fields.photo,
    birthDate: fields.birthDate?.trim() || undefined,
    birthOrder: fields.birthOrder,
    isDeceased: Boolean(fields.isDeceased),
    deathDate: fields.isDeceased ? fields.deathDate?.trim() || undefined : undefined,
    occupation: fields.occupation?.trim() || undefined,
    branch: fields.branch?.trim() || anchor.branch,
    notes: fields.notes?.trim() || undefined,
  });

  let nextData = upsertPerson(data, newPerson);

  if (relation === 'child') {
    const res1 = linkParentChild(nextData, anchorId, newPerson.id);
    nextData = res1.data;
    // Also attach second parent if specified (or the anchor's sole current spouse)
    const coParentId =
      fields.otherParentId ||
      (anchor.spouses.length === 1 ? anchor.spouses[0].spouseId : undefined);
    if (coParentId && nextData.members[coParentId]) {
      const res2 = linkParentChild(nextData, coParentId, newPerson.id);
      nextData = res2.data;
    }
  } else if (relation === 'spouse') {
    const res = linkSpouses(nextData, anchorId, newPerson.id, fields.spouseStatus ?? 'married');
    nextData = res.data;
  } else if (relation === 'parent') {
    if (anchor.parentIds.length >= 2) {
      return {
        data,
        newPersonId: '',
        error: 'สมาชิกคนนี้มีข้อมูลพ่อและแม่ครบ 2 คนแล้ว',
      };
    }
    const existingParentId = anchor.parentIds[0];
    const res = linkParentChild(nextData, newPerson.id, anchorId);
    if (res.error) return { data, newPersonId: '', error: res.error };
    nextData = res.data;
    // If anchor already has 1 parent and that parent has no spouse yet, optionally link them as spouses
    if (existingParentId && nextData.members[existingParentId]) {
      const existingParent = nextData.members[existingParentId];
      if (!existingParent.spouses.some((s) => s.spouseId === newPerson.id)) {
        const spRes = linkSpouses(nextData, existingParentId, newPerson.id, 'married');
        nextData = spRes.data;
      }
    }
  } else if (relation === 'sibling') {
    if (anchor.parentIds.length > 0) {
      for (const pid of anchor.parentIds) {
        const res = linkParentChild(nextData, pid, newPerson.id);
        nextData = res.data;
      }
    } else {
      const sharedParent = createBlankPerson({
        firstName: 'บรรพบุรุษ (ไม่ระบุชื่อ)',
        lastName: anchor.lastName || fields.lastName,
        gender: 'male',
        branch: anchor.branch,
        bio: 'สร้างขึ้นอัตโนมัติเพื่อเชื่อมโยงพี่น้อง สามารถกดแก้ไขชื่อได้',
      });
      nextData = upsertPerson(nextData, sharedParent);
      nextData = linkParentChild(nextData, sharedParent.id, anchorId).data;
      nextData = linkParentChild(nextData, sharedParent.id, newPerson.id).data;
    }
  }

  return { data: nextData, newPersonId: newPerson.id };
}

export function validateImportedData(raw: unknown): FamilyTreeData | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<FamilyTreeData>;
  if (typeof obj.clanName !== 'string' || !obj.members || typeof obj.members !== 'object') {
    return null;
  }
  const sanitizedMembers: Record<string, Person> = {};
  for (const [id, m] of Object.entries(obj.members)) {
    if (!m || typeof m !== 'object') continue;
    const pm = m as Partial<Person>;
    sanitizedMembers[id] = {
      id: pm.id || id,
      title: pm.title,
      firstName: pm.firstName || 'ไม่ระบุชื่อ',
      lastName: pm.lastName || '',
      maidenName: pm.maidenName,
      nickname: pm.nickname,
      gender: pm.gender === 'female' || pm.gender === 'other' ? pm.gender : 'male',
      photo: pm.photo,
      gallery: Array.isArray(pm.gallery) ? pm.gallery : undefined,
      birthDate: pm.birthDate,
      birthPlace: pm.birthPlace,
      isDeceased: Boolean(pm.isDeceased),
      deathDate: pm.deathDate,
      occupation: pm.occupation,
      education: pm.education,
      phone: pm.phone,
      lineId: pm.lineId,
      address: pm.address,
      branch: pm.branch,
      bio: pm.bio,
      notes: pm.notes,
      parentIds: Array.isArray(pm.parentIds) ? pm.parentIds : [],
      spouses: Array.isArray(pm.spouses) ? pm.spouses : [],
      birthOrder: pm.birthOrder,
      createdAt: pm.createdAt || new Date().toISOString(),
      updatedAt: pm.updatedAt || new Date().toISOString(),
    };
  }

  return {
    id: obj.id || generateId('tree'),
    clanName: obj.clanName,
    motto: obj.motto,
    rootPersonId: obj.rootPersonId,
    members: sanitizedMembers,
    updatedAt: new Date().toISOString(),
  };
}
