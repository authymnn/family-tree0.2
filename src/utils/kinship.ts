import { Person } from '../types/family';
import { compareBirthDates } from './dateUtils';

export interface KinshipStep {
  fromId: string;
  toId: string;
  edgeType: 'parent' | 'child' | 'spouse';
  label: string;
}

export interface KinshipResult {
  found: boolean;
  title: string;          // เช่น "คุณปู่ (ฝ่ายพ่อ)", "ลุง", "ลูกพี่ลูกน้อง", "หลาน"
  explanation: string;    // คำอธิบายภาษาไทยเข้าใจง่าย
  pathIds: string[];      // List of person IDs from A to B
  steps: KinshipStep[];
}

function getAllAncestorsWithDepth(
  members: Record<string, Person>,
  startId: string
): Map<string, { depth: number; path: string[] }> {
  const map = new Map<string, { depth: number; path: string[] }>();
  const queue: Array<{ id: string; depth: number; path: string[] }> = [
    { id: startId, depth: 0, path: [startId] },
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (map.has(curr.id)) continue;
    map.set(curr.id, { depth: curr.depth, path: curr.path });
    const person = members[curr.id];
    if (!person) continue;
    for (const pid of person.parentIds) {
      if (members[pid] && !map.has(pid)) {
        queue.push({ id: pid, depth: curr.depth + 1, path: [...curr.path, pid] });
      }
    }
  }
  return map;
}

function isOlderThan(a: Person, b: Person): boolean | null {
  if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
    return a.birthOrder < b.birthOrder;
  }
  if (!a.birthDate || !b.birthDate) return null;
  const cmp = compareBirthDates(a.birthDate, b.birthDate);
  if (cmp === 0) return null;
  return cmp < 0;
}

/**
 * Determine Thai kinship term describing: "B เป็นอะไรกับ A" (What is person B to person A?)
 */
export function findThaiKinship(
  members: Record<string, Person>,
  personAId: string,
  personBId: string
): KinshipResult {
  const a = members[personAId];
  const b = members[personBId];
  if (!a || !b) {
    return { found: false, title: 'ไม่พบข้อมูล', explanation: '', pathIds: [], steps: [] };
  }
  if (personAId === personBId) {
    return {
      found: true,
      title: 'บุคคลเดียวกัน',
      explanation: `${a.firstName} คือบุคคลเดียวกัน`,
      pathIds: [personAId],
      steps: [],
    };
  }

  // Direct spouse check
  if (a.spouses.some((s) => s.spouseId === personBId)) {
    const sp = a.spouses.find((s) => s.spouseId === personBId)!;
    const role = b.gender === 'male' ? 'สามี' : b.gender === 'female' ? 'ภรรยา' : 'คู่สมรส';
    const statusNote =
      sp.status === 'divorced'
        ? ' (หย่าร้าง)'
        : sp.status === 'widowed'
          ? ' (คู่สมรสผู้ล่วงลับ)'
          : '';
    return {
      found: true,
      title: `${role}${statusNote}`,
      explanation: `${b.firstName} เป็น${role}ของ ${a.firstName}`,
      pathIds: [personAId, personBId],
      steps: [{ fromId: personAId, toId: personBId, edgeType: 'spouse', label: role }],
    };
  }

  // Check blood relationship via Lowest Common Ancestor (LCA)
  const ancA = getAllAncestorsWithDepth(members, personAId);
  const ancB = getAllAncestorsWithDepth(members, personBId);

  let bestLca: { id: string; upA: number; upB: number; pathA: string[]; pathB: string[] } | null = null;
  for (const [ancId, infoA] of ancA.entries()) {
    const infoB = ancB.get(ancId);
    if (infoB) {
      const total = infoA.depth + infoB.depth;
      if (!bestLca || total < bestLca.upA + bestLca.upB) {
        bestLca = {
          id: ancId,
          upA: infoA.depth,
          upB: infoB.depth,
          pathA: infoA.path,
          pathB: infoB.path,
        };
      }
    }
  }

  if (bestLca) {
    const { upA, upB, pathA, pathB } = bestLca;
    const fullPath = [...pathA, ...pathB.slice(0, -1).reverse()];
    const steps: KinshipStep[] = [];
    for (let i = 0; i < pathA.length - 1; i++) {
      const parent = members[pathA[i + 1]];
      steps.push({
        fromId: pathA[i],
        toId: pathA[i + 1],
        edgeType: 'parent',
        label: parent?.gender === 'female' ? 'แม่' : 'พ่อ',
      });
    }
    const downPath = [...pathB].reverse();
    for (let i = 0; i < downPath.length - 1; i++) {
      const child = members[downPath[i + 1]];
      steps.push({
        fromId: downPath[i],
        toId: downPath[i + 1],
        edgeType: 'child',
        label: child?.gender === 'female' ? 'ลูกสาว' : 'ลูกชาย',
      });
    }

    let title = '';
    // Direct ancestor (B is ancestor of A)
    if (upB === 0) {
      if (upA === 1) {
        title = b.gender === 'male' ? 'พ่อ' : b.gender === 'female' ? 'แม่' : 'บิดา/มารดา';
      } else if (upA === 2) {
        const parentOfA = members[pathA[1]];
        const isPaternal = parentOfA?.gender === 'male';
        if (isPaternal) {
          title = b.gender === 'male' ? 'ปู่ (ฝ่ายพ่อ)' : 'ย่า (ฝ่ายพ่อ)';
        } else {
          title = b.gender === 'male' ? 'ตา (ฝ่ายแม่)' : 'ยาย (ฝ่ายแม่)';
        }
      } else if (upA === 3) {
        title = b.gender === 'male' ? 'ทวด (ชาย)' : 'ทวด (หญิง)';
      } else if (upA === 4) {
        title = 'เทียด (บรรพบุรุษ 4 รุ่น)';
      } else {
        title = `บรรพบุรุษสายตรง (ห่างขึ้นไป ${upA} รุ่น)`;
      }
    }
    // Direct descendant (B is descendant of A)
    else if (upA === 0) {
      if (upB === 1) {
        title = b.gender === 'male' ? 'ลูกชาย' : b.gender === 'female' ? 'ลูกสาว' : 'บุตร';
      } else if (upB === 2) {
        title = b.gender === 'male' ? 'หลานชาย (สายตรง)' : 'หลานสาว (สายตรง)';
      } else if (upB === 3) {
        title = 'เหลน';
      } else if (upB === 4) {
        title = 'ลื่อ';
      } else {
        title = `ทายาทสายตรง (ห่างลงมา ${upB} รุ่น)`;
      }
    }
    // Siblings
    else if (upA === 1 && upB === 1) {
      const bOlder = isOlderThan(b, a);
      if (bOlder === true) {
        title = b.gender === 'male' ? 'พี่ชาย' : b.gender === 'female' ? 'พี่สาว' : 'พี่';
      } else if (bOlder === false) {
        title = b.gender === 'male' ? 'น้องชาย' : b.gender === 'female' ? 'น้องสาว' : 'น้อง';
      } else {
        title = 'พี่น้อง';
      }
    }
    // Uncles & Aunts (B is sibling of A's parent)
    else if (upA === 2 && upB === 1) {
      const parentOfA = members[pathA[1]];
      const bOlder = parentOfA ? isOlderThan(b, parentOfA) : null;
      if (bOlder === true) {
        title = b.gender === 'male' ? 'ลุง' : 'ป้า';
      } else if (bOlder === false) {
        if (parentOfA?.gender === 'male') {
          title = b.gender === 'male' ? 'อา (ชาย / น้องพ่อ)' : 'อา (หญิง / น้องพ่อ)';
        } else {
          title = b.gender === 'male' ? 'น้า (ชาย / น้องแม่)' : 'น้า (หญิง / น้องแม่)';
        }
      } else {
        title = parentOfA?.gender === 'male' ? 'ลุง/ป้า/อา (ฝ่ายพ่อ)' : 'ลุง/ป้า/น้า (ฝ่ายแม่)';
      }
    }
    // Nieces & Nephews (B is child of A's sibling)
    else if (upA === 1 && upB === 2) {
      title = b.gender === 'male' ? 'หลานชาย (ลูกของพี่น้อง)' : 'หลานสาว (ลูกของพี่น้อง)';
    }
    // First cousins
    else if (upA === 2 && upB === 2) {
      const bOlder = isOlderThan(b, a);
      title =
        bOlder === true
          ? 'ลูกพี่ลูกน้อง (ผู้พี่)'
          : bOlder === false
            ? 'ลูกพี่ลูกน้อง (ผู้น้อง)'
            : 'ลูกพี่ลูกน้อง';
    }
    // Great-uncle / Great-aunt
    else if (upA === 3 && upB === 1) {
      title = b.gender === 'male' ? 'ปู่เล็ก/ตาเล็ก (พี่น้องของปู่ย่าตายาย)' : 'ย่าเล็ก/ยายเล็ก (พี่น้องของปู่ย่าตายาย)';
    }
    // Grand-niece / nephew
    else if (upA === 1 && upB === 3) {
      title = 'หลานเหลน (หลานของพี่น้อง)';
    } else if (upA === upB) {
      title = `ญาติรุ่นเดียวกัน (ลูกพี่ลูกน้องชั้นที่ ${upA - 1})`;
    } else if (upA > upB) {
      title = `ญาติผู้ใหญ่ (สูงกว่า ${upA - upB} รุ่น)`;
    } else {
      title = `หลาน/ญาติรุ่นลูกหลาน (ต่ำกว่า ${upB - upA} รุ่น)`;
    }

    return {
      found: true,
      title,
      explanation: `${b.firstName} เป็น "${title}" ของ ${a.firstName}`,
      pathIds: fullPath,
      steps,
    };
  }

  // Fallback BFS including spouse edges (for in-laws: เขย, สะใภ้, พ่อตา, แม่ยาย, etc.)
  const visited = new Set<string>([personAId]);
  const queue: Array<{ id: string; steps: KinshipStep[] }> = [{ id: personAId, steps: [] }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const p = members[curr.id];
    if (!p) continue;

    const neighbors: Array<{ nextId: string; edgeType: 'parent' | 'child' | 'spouse'; label: string }> = [];

    for (const pid of p.parentIds) {
      if (members[pid]) {
        neighbors.push({
          nextId: pid,
          edgeType: 'parent',
          label: members[pid].gender === 'female' ? 'แม่' : 'พ่อ',
        });
      }
    }
    for (const m of Object.values(members)) {
      if (m.parentIds.includes(curr.id)) {
        neighbors.push({
          nextId: m.id,
          edgeType: 'child',
          label: m.gender === 'female' ? 'ลูกสาว' : 'ลูกชาย',
        });
      }
    }
    for (const sp of p.spouses) {
      if (members[sp.spouseId]) {
        neighbors.push({
          nextId: sp.spouseId,
          edgeType: 'spouse',
          label: members[sp.spouseId].gender === 'female' ? 'ภรรยา' : 'สามี',
        });
      }
    }

    for (const nb of neighbors) {
      if (visited.has(nb.nextId)) continue;
      const nextSteps: KinshipStep[] = [
        ...curr.steps,
        { fromId: curr.id, toId: nb.nextId, edgeType: nb.edgeType, label: nb.label },
      ];
      if (nb.nextId === personBId) {
        const title = inferInLawTitle(nextSteps, b);
        return {
          found: true,
          title,
          explanation: `${b.firstName} เกี่ยวข้องทางเครือญาติ/การสมรสเป็น "${title}" ของ ${a.firstName}`,
          pathIds: [personAId, ...nextSteps.map((s) => s.toId)],
          steps: nextSteps,
        };
      }
      visited.add(nb.nextId);
      queue.push({ id: nb.nextId, steps: nextSteps });
    }
  }

  return {
    found: false,
    title: 'ยังไม่เชื่อมโยงกัน',
    explanation: `ไม่พบเส้นทางความสัมพันธ์ระหว่าง ${a.firstName} และ ${b.firstName} ในผังตระกูลนี้`,
    pathIds: [],
    steps: [],
  };
}

function inferInLawTitle(steps: KinshipStep[], b: Person): string {
  const sig = steps.map((s) => s.edgeType).join('-');
  if (sig === 'child-spouse') {
    return b.gender === 'male' ? 'ลูกเขย' : 'ลูกสะใภ้';
  }
  if (sig === 'spouse-parent') {
    return b.gender === 'male' ? 'พ่อตา / พ่อสามี' : 'แม่ยาย / แม่สามี';
  }
  if (sig === 'parent-child-spouse') {
    return b.gender === 'male' ? 'พี่เขย / น้องเขย' : 'พี่สะใภ้ / น้องสะใภ้';
  }
  if (sig === 'spouse-parent-child') {
    return b.gender === 'male' ? 'พี่เขย / น้องเขย (ฝั่งคู่สมรส)' : 'พี่สะใภ้ / น้องสะใภ้ (ฝั่งคู่สมรส)';
  }
  if (sig === 'parent-parent-child-spouse') {
    return b.gender === 'male' ? 'ลุงเขย / อาเขย / น้าเขย' : 'ป้าสะใภ้ / อาสะใภ้ / น้าสะใภ้';
  }
  if (sig === 'child-child-spouse') {
    return b.gender === 'male' ? 'หลานเขย' : 'หลานสะใภ้';
  }
  return `ญาติเกี่ยวดอง (ห่าง ${steps.length} ขั้น)`;
}

/**
 * Get direct lineage IDs (all ancestors + all descendants + immediate spouses) for visual highlighting
 */
export function getLineageHighlightSet(
  members: Record<string, Person>,
  personId: string
): Set<string> {
  const result = new Set<string>([personId]);
  const person = members[personId];
  if (!person) return result;

  // Immediate spouses
  for (const sp of person.spouses) {
    result.add(sp.spouseId);
  }

  // Walk UP (ancestors)
  const upQueue = [...person.parentIds];
  while (upQueue.length > 0) {
    const pid = upQueue.shift()!;
    if (result.has(pid) || !members[pid]) continue;
    result.add(pid);
    for (const grandId of members[pid].parentIds) {
      upQueue.push(grandId);
    }
  }

  // Walk DOWN (descendants)
  const downQueue = [personId];
  const visitedDown = new Set<string>([personId]);
  while (downQueue.length > 0) {
    const curr = downQueue.shift()!;
    for (const m of Object.values(members)) {
      if (m.parentIds.includes(curr) && !visitedDown.has(m.id)) {
        visitedDown.add(m.id);
        result.add(m.id);
        downQueue.push(m.id);
      }
    }
  }

  return result;
}
