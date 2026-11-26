const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export interface ParsedDate {
  year: number;
  month?: number; // 1-12
  day?: number;   // 1-31
}

export function parseFlexibleDate(dateStr?: string): ParsedDate | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  const fullMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (fullMatch) {
    return {
      year: parseInt(fullMatch[1], 10),
      month: parseInt(fullMatch[2], 10),
      day: parseInt(fullMatch[3], 10),
    };
  }
  const ymMatch = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  if (ymMatch) {
    return {
      year: parseInt(ymMatch[1], 10),
      month: parseInt(ymMatch[2], 10),
    };
  }
  const yMatch = /^(\d{4})$/.exec(trimmed);
  if (yMatch) {
    return { year: parseInt(yMatch[1], 10) };
  }
  return null;
}

/**
 * Format YYYY-MM-DD or YYYY into Thai Buddhist Era (พ.ศ.)
 */
export function formatThaiDate(dateStr?: string, style: 'short' | 'full' = 'short'): string {
  const parsed = parseFlexibleDate(dateStr);
  if (!parsed) return '';
  const beYear = parsed.year + 543;
  if (parsed.day && parsed.month) {
    const monthName =
      style === 'full'
        ? THAI_MONTHS_FULL[parsed.month - 1]
        : THAI_MONTHS_SHORT[parsed.month - 1];
    return `${parsed.day} ${monthName} ${beYear}`;
  }
  if (parsed.month) {
    const monthName =
      style === 'full'
        ? THAI_MONTHS_FULL[parsed.month - 1]
        : THAI_MONTHS_SHORT[parsed.month - 1];
    return `${monthName} ${beYear}`;
  }
  return `พ.ศ. ${beYear}`;
}

export function formatYearSpan(birthDate?: string, deathDate?: string, isDeceased?: boolean): string {
  const b = parseFlexibleDate(birthDate);
  const d = parseFlexibleDate(deathDate);
  if (!b && !d) return isDeceased ? 'ล่วงลับ' : '';
  const bYear = b ? `${b.year + 543}` : '?';
  if (isDeceased) {
    const dYear = d ? `${d.year + 543}` : '?';
    return `พ.ศ. ${bYear} – ${dYear}`;
  }
  return `เกิด พ.ศ. ${bYear}`;
}

export function calculateAge(birthDate?: string, deathDate?: string, isDeceased?: boolean): number | null {
  const b = parseFlexibleDate(birthDate);
  if (!b) return null;

  let refYear: number;
  let refMonth: number;
  let refDay: number;

  if (isDeceased) {
    const d = parseFlexibleDate(deathDate);
    if (!d) return null;
    refYear = d.year;
    refMonth = d.month ?? 12;
    refDay = d.day ?? 31;
  } else {
    const now = new Date();
    refYear = now.getFullYear();
    refMonth = now.getMonth() + 1;
    refDay = now.getDate();
  }

  let age = refYear - b.year;
  if (b.month) {
    if (refMonth < b.month || (refMonth === b.month && b.day && refDay < b.day)) {
      age -= 1;
    }
  }
  return age >= 0 ? age : null;
}

/**
 * Calculate days until next birthday (0 = today, null if no month/day)
 */
export function daysUntilNextBirthday(birthDate?: string): number | null {
  const b = parseFlexibleDate(birthDate);
  if (!b || !b.month || !b.day) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), b.month - 1, b.day);
  if (next < today) {
    next = new Date(now.getFullYear() + 1, b.month - 1, b.day);
  }
  const diffMs = next.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function compareBirthDates(a?: string, b?: string): number {
  const pa = parseFlexibleDate(a);
  const pb = parseFlexibleDate(b);
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  if (pa.year !== pb.year) return pa.year - pb.year;
  if ((pa.month ?? 6) !== (pb.month ?? 6)) return (pa.month ?? 6) - (pb.month ?? 6);
  return (pa.day ?? 15) - (pb.day ?? 15);
}

/**
 * Calculate completed years since a milestone date (e.g., marriage anniversary years)
 */
export function calculateYearsSince(dateStr?: string): number | null {
  return calculateAge(dateStr, undefined, false);
}

/**
 * Days until next annual anniversary (0 = today, null if no month/day)
 */
export function daysUntilNextAnniversary(dateStr?: string): number | null {
  return daysUntilNextBirthday(dateStr);
}
