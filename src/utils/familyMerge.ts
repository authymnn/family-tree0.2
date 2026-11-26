import { FamilyTreeData, Person, PhotoItem, SpouseLink } from '../types/family';
import { calculateAge, formatThaiDate } from './dateUtils';
import { getFullName, getSiblingRankInfo } from './familyOps';

function parseTs(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function mergeGallery(
  baseList: PhotoItem[] = [],
  localList: PhotoItem[] = [],
  remoteList: PhotoItem[] = []
): PhotoItem[] | undefined {
  const baseIds = new Set(baseList.map((p) => p.id));
  const localMap = new Map(localList.map((p) => [p.id, p]));
  const remoteMap = new Map(remoteList.map((p) => [p.id, p]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const merged: PhotoItem[] = [];
  for (const id of allIds) {
    const inBase = baseIds.has(id);
    const loc = localMap.get(id);
    const rem = remoteMap.get(id);
    if (loc && rem) {
      merged.push(loc);
    } else if (loc && !rem) {
      // Added locally OR deleted remotely
      if (!inBase) merged.push(loc);
    } else if (!loc && rem) {
      // Added remotely OR deleted locally
      if (!inBase) merged.push(rem);
    }
  }
  return merged.length > 0 ? merged : undefined;
}

function mergeSpouses(
  baseList: SpouseLink[],
  localList: SpouseLink[],
  remoteList: SpouseLink[],
  localNewer: boolean
): SpouseLink[] {
  const baseMap = new Map(baseList.map((s) => [s.spouseId, s]));
  const localMap = new Map(localList.map((s) => [s.spouseId, s]));
  const remoteMap = new Map(remoteList.map((s) => [s.spouseId, s]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const merged: SpouseLink[] = [];
  for (const sid of allIds) {
    const b = baseMap.get(sid);
    const l = localMap.get(sid);
    const r = remoteMap.get(sid);

    if (l && r) {
      // Merge individual fields of SpouseLink against base
      const pick = <K extends keyof SpouseLink>(key: K): SpouseLink[K] => {
        const bVal = b?.[key];
        const lVal = l[key];
        const rVal = r[key];
        if (lVal === rVal) return lVal;
        if (lVal !== bVal && rVal === bVal) return lVal;
        if (rVal !== bVal && lVal === bVal) return rVal;
        return localNewer ? lVal : rVal;
      };
      merged.push({
        spouseId: sid,
        status: pick('status'),
        familyName: pick('familyName'),
        color: pick('color'),
        marriageDate: pick('marriageDate'),
        marriagePlace: pick('marriagePlace'),
        residence: pick('residence'),
        note: pick('note'),
      });
    } else if (l && !r) {
      if (!b) merged.push(l); // added locally
    } else if (!l && r) {
      if (!b) merged.push(r); // added remotely
    }
  }
  return merged;
}

function mergeParentIds(baseIds: string[], localIds: string[], remoteIds: string[]): string[] {
  const baseSet = new Set(baseIds);
  const localSet = new Set(localIds);
  const remoteSet = new Set(remoteIds);
  const all = new Set([...localIds, ...remoteIds]);

  const result: string[] = [];
  for (const pid of all) {
    const inB = baseSet.has(pid);
    const inL = localSet.has(pid);
    const inR = remoteSet.has(pid);
    if (inL && inR) result.push(pid);
    else if (inL && !inR && !inB) result.push(pid);
    else if (inR && !inL && !inB) result.push(pid);
  }
  return result.slice(0, 2);
}

const SCALAR_PERSON_KEYS: Array<keyof Person> = [
  'title',
  'firstName',
  'lastName',
  'maidenName',
  'nickname',
  'gender',
  'photo',
  'birthDate',
  'birthPlace',
  'isDeceased',
  'deathDate',
  'occupation',
  'education',
  'phone',
  'lineId',
  'address',
  'branch',
  'bio',
  'notes',
  'birthOrder',
];

function mergePersonRecord(base: Person | undefined, local: Person, remote: Person): Person {
  const localNewer = parseTs(local.updatedAt) >= parseTs(remote.updatedAt);

  // Fast path: if only one side changed relative to base
  if (base) {
    const localChanged = JSON.stringify(local) !== JSON.stringify(base);
    const remoteChanged = JSON.stringify(remote) !== JSON.stringify(base);
    if (localChanged && !remoteChanged) return local;
    if (remoteChanged && !localChanged) return remote;
    if (!localChanged && !remoteChanged) return remote;
  }

  // True 3-way field-by-field merge!
  const merged: Person = {
    ...remote,
    id: local.id,
    createdAt: local.createdAt || remote.createdAt,
    updatedAt: localNewer ? local.updatedAt : remote.updatedAt,
    parentIds: mergeParentIds(base?.parentIds ?? [], local.parentIds, remote.parentIds),
    spouses: mergeSpouses(base?.spouses ?? [], local.spouses, remote.spouses, localNewer),
    gallery: mergeGallery(base?.gallery, local.gallery, remote.gallery),
  };

  for (const key of SCALAR_PERSON_KEYS) {
    const bVal = base?.[key];
    const lVal = local[key];
    const rVal = remote[key];
    let chosen: unknown;
    if (lVal === rVal) chosen = lVal;
    else if (lVal !== bVal && rVal === bVal) chosen = lVal;
    else if (rVal !== bVal && lVal === bVal) chosen = rVal;
    else chosen = localNewer ? lVal : rVal;

    (merged as unknown as Record<string, unknown>)[key] = chosen;
  }

  return merged;
}

/**
 * Conflict-free 3-Way Smart Merge for concurrent multi-user family tree editing!
 * Combines additions, edits, and deletions made simultaneously by multiple relatives
 * so nobody overwrites another person's work.
 */
export function mergeFamilyTreeData(
  base: FamilyTreeData | null,
  local: FamilyTreeData,
  remote: FamilyTreeData
): { merged: FamilyTreeData; hadRemoteAdditionsOrEdits: boolean } {
  const baseMembers = base?.members ?? {};
  const localMembers = local.members;
  const remoteMembers = remote.members;

  const allIds = new Set([...Object.keys(localMembers), ...Object.keys(remoteMembers)]);
  const nextMembers: Record<string, Person> = {};
  let hadRemoteAdditionsOrEdits = false;

  for (const id of allIds) {
    const b = baseMembers[id];
    const l = localMembers[id];
    const r = remoteMembers[id];

    if (l && r) {
      const mergedPerson = mergePersonRecord(b, l, r);
      nextMembers[id] = mergedPerson;
      if (JSON.stringify(mergedPerson) !== JSON.stringify(l)) {
        hadRemoteAdditionsOrEdits = true;
      }
    } else if (l && !r) {
      if (!b) {
        // Brand-new member added locally
        nextMembers[id] = l;
      } else {
        // Existed in base, deleted remotely — keep local ONLY if locally edited after base
        if (JSON.stringify(l) !== JSON.stringify(b)) {
          nextMembers[id] = l;
        } else {
          hadRemoteAdditionsOrEdits = true;
        }
      }
    } else if (!l && r) {
      if (!b) {
        // Brand-new member added remotely by another relative! Keep!
        nextMembers[id] = r;
        hadRemoteAdditionsOrEdits = true;
      } else {
        // Existed in base, deleted locally — keep remote ONLY if remotely edited after base
        if (JSON.stringify(r) !== JSON.stringify(b)) {
          nextMembers[id] = r;
          hadRemoteAdditionsOrEdits = true;
        }
      }
    }
  }

  // Clean dangling parent/spouse references pointing to deleted members
  for (const [id, m] of Object.entries(nextMembers)) {
    const cleanParents = m.parentIds.filter((pid) => Boolean(nextMembers[pid]));
    const cleanSpouses = m.spouses.filter((s) => Boolean(nextMembers[s.spouseId]));
    if (cleanParents.length !== m.parentIds.length || cleanSpouses.length !== m.spouses.length) {
      nextMembers[id] = {
        ...m,
        parentIds: cleanParents,
        spouses: cleanSpouses,
      };
    }
  }

  const localNewer = parseTs(local.updatedAt) >= parseTs(remote.updatedAt);
  const pickRootField = <K extends 'clanName' | 'motto' | 'rootPersonId'>(key: K) => {
    const bVal = base?.[key];
    const lVal = local[key];
    const rVal = remote[key];
    if (lVal === rVal) return lVal;
    if (lVal !== bVal && rVal === bVal) return lVal;
    if (rVal !== bVal && lVal === bVal) return rVal;
    return localNewer ? lVal : rVal;
  };

  return {
    merged: {
      id: remote.id || local.id,
      clanName: pickRootField('clanName') || local.clanName,
      motto: pickRootField('motto'),
      rootPersonId: pickRootField('rootPersonId'),
      members: nextMembers,
      updatedAt: new Date().toISOString(),
    },
    hadRemoteAdditionsOrEdits,
  };
}

/**
 * Build full tabular rows for Google Sheets / Excel export (CSV or Clipboard TSV).
 */
export function buildFamilySheetRows(
  data: FamilyTreeData,
  generationMap: Record<string, number>
): { headers: string[]; rows: string[][] } {
  const headers = [
    'รุ่น',
    'ลำดับพี่น้อง',
    'คำนำหน้า',
    'ชื่อจริง',
    'นามสกุล',
    'นามสกุลเดิม',
    'ชื่อเล่น',
    'เพศ',
    'สถานะ',
    'วันเกิด',
    'อายุ',
    'สายตระกูล',
    'บิดา/มารดา',
    'คู่สมรส',
    'อาชีพ',
    'การศึกษา',
    'เบอร์โทร',
    'Line ID',
    'ที่อยู่',
    'หมายเหตุ',
    'ประวัติย่อ',
  ];

  const sorted = Object.values(data.members).sort((a, b) => {
    const ga = generationMap[a.id] ?? 99;
    const gb = generationMap[b.id] ?? 99;
    if (ga !== gb) return ga - gb;
    if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
      return a.birthOrder - b.birthOrder;
    }
    return a.firstName.localeCompare(b.firstName, 'th');
  });

  const rows = sorted.map((m) => {
    const age = calculateAge(m.birthDate, m.deathDate, m.isDeceased);
    const rank = getSiblingRankInfo(data.members, m.id);
    const parentNames = m.parentIds
      .map((pid) => data.members[pid])
      .filter(Boolean)
      .map((p) => getFullName(p))
      .join(' / ');
    const spouseNames = m.spouses
      .map((s) => data.members[s.spouseId])
      .filter(Boolean)
      .map((sp) => getFullName(sp))
      .join(' / ');

    return [
      String(generationMap[m.id] ?? ''),
      rank?.label || '',
      m.title || '',
      m.firstName,
      m.lastName,
      m.maidenName || '',
      m.nickname || '',
      m.gender === 'male' ? 'ชาย' : m.gender === 'female' ? 'หญิง' : 'อื่นๆ',
      m.isDeceased ? 'ล่วงลับ' : 'ยังมีชีวิต',
      m.birthDate ? formatThaiDate(m.birthDate) : '',
      age != null ? String(age) : '',
      m.branch || '',
      parentNames,
      spouseNames,
      m.occupation || '',
      m.education || '',
      m.phone || '',
      m.lineId || '',
      m.address || '',
      m.notes || '',
      m.bio || '',
    ];
  });

  return { headers, rows };
}

export function downloadFamilyCsv(
  data: FamilyTreeData,
  generationMap: Record<string, number>
): void {
  const { headers, rows } = buildFamilySheetRows(data, generationMap);
  const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const bom = '\uFEFF'; // UTF-8 BOM for crisp Thai in Excel & Google Sheets
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.clanName || 'family_tree').replace(/[^a-zA-Z0-9ก-๙_-]+/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${safeName}_sheet_${dateStamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy tab-separated values (TSV) to clipboard — pastes cleanly into Google Sheets & Excel cells!
 */
export async function copyFamilyForGoogleSheets(
  data: FamilyTreeData,
  generationMap: Record<string, number>
): Promise<void> {
  const { headers, rows } = buildFamilySheetRows(data, generationMap);
  const cleanCell = (v: string) => (v || '').replace(/\t/g, ' ').replace(/\r?\n/g, ' / ');
  const tsv = [
    headers.map(cleanCell).join('\t'),
    ...rows.map((r) => r.map(cleanCell).join('\t')),
  ].join('\n');

  await navigator.clipboard.writeText(tsv);
}
