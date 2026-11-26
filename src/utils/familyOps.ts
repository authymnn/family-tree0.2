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
