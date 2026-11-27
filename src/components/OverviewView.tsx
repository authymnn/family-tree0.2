import React, { useMemo } from 'react';
import {
  Users,
  Heart,
  Layers,
  Cake,
  GitBranch,
  Award,
  Sparkles,
  Home,
  CalendarHeart,
  Settings2,
  MapPin,
} from 'lucide-react';
import { FamilyTreeData, SpouseStatus } from '../types/family';
import {
  calculateAge,
  calculateYearsSince,
  daysUntilNextAnniversary,
  daysUntilNextBirthday,
  formatThaiDate,
} from '../utils/dateUtils';
import {
  getCoupleUnits,
  getDisplayNameWithNickname,
} from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';

interface OverviewViewProps {
  data: FamilyTreeData;
  generationMap: Record<string, number>;
  canEdit?: boolean;
  onSelectPerson: (personId: string) => void;
  onOpenCoupleDetail: (personAId: string, personBId: string) => void;
}

const STATUS_BADGE: Record<SpouseStatus, { label: string; cls: string }> = {
  married: { label: 'สมรส', cls: 'bg-[#E9F2EE] text-[#225144]' },
  partner: { label: 'คู่ชีวิต', cls: 'bg-[#E9F2EE] text-[#225144]' },
  divorced: { label: 'หย่าร้าง', cls: 'bg-[#FCEEEB] text-[#9E3B28]' },
  widowed: { label: 'คู่สมรสผู้ล่วงลับ', cls: 'bg-[#EAE6DF] text-[#645E56]' },
};

export const OverviewView: React.FC<OverviewViewProps> = ({
  data,
  generationMap,
  canEdit = true,
  onSelectPerson,
  onOpenCoupleDetail,
}) => {
  const members = useMemo(() => Object.values(data.members), [data.members]);
  const couples = useMemo(() => {
    return getCoupleUnits(data.members).sort((a, b) => {
      const ga = generationMap[a.personA.id] ?? 99;
      const gb = generationMap[b.personA.id] ?? 99;
      if (ga !== gb) return ga - gb;
      return a.personA.firstName.localeCompare(b.personA.firstName, 'th');
    });
  }, [data.members, generationMap]);

  const stats = useMemo(() => {
    const total = members.length;
    const living = members.filter((m) => !m.isDeceased).length;
    const deceased = total - living;
    const male = members.filter((m) => m.gender === 'male').length;
    const female = members.filter((m) => m.gender === 'female').length;

    const genCounts = new Map<number, number>();
    const branchCounts = new Map<string, number>();

    for (const m of members) {
      const g = generationMap[m.id] ?? 1;
      genCounts.set(g, (genCounts.get(g) ?? 0) + 1);
      const b = m.branch?.trim() || 'ไม่ระบุสาย';
      branchCounts.set(b, (branchCounts.get(b) ?? 0) + 1);
    }

    const genList = Array.from(genCounts.entries()).sort((a, b) => a[0] - b[0]);
    const branchList = Array.from(branchCounts.entries()).sort((a, b) => b[1] - a[1]);

    // Upcoming birthdays (living members within next 90 days)
    const upcomingBirthdays = members
      .filter((m) => !m.isDeceased && m.birthDate)
      .map((m) => ({
        person: m,
        days: daysUntilNextBirthday(m.birthDate),
        age: calculateAge(m.birthDate, undefined, false),
      }))
      .filter(
        (item): item is { person: typeof item.person; days: number; age: number | null } =>
          item.days !== null && item.days <= 90
      )
      .sort((a, b) => a.days - b.days)
      .slice(0, 6);

    // Upcoming Wedding Anniversaries (active married/partner couples within 90 days)
    const upcomingAnniversaries = couples
      .filter(
        (c) =>
          (c.link.status === 'married' || c.link.status === 'partner') &&
          c.link.marriageDate
      )
      .map((c) => ({
        couple: c,
        days: daysUntilNextAnniversary(c.link.marriageDate),
        years: calculateYearsSince(c.link.marriageDate),
      }))
      .filter(
        (item): item is { couple: typeof item.couple; days: number; years: number | null } =>
          item.days !== null && item.days <= 90
      )
      .sort((a, b) => a.days - b.days);

    // Eldest living members
    const eldestLiving = members
      .filter((m) => !m.isDeceased && m.birthDate)
      .map((m) => ({ person: m, age: calculateAge(m.birthDate, undefined, false) }))
      .filter((item): item is { person: typeof item.person; age: number } => item.age !== null)
      .sort((a, b) => b.age - a.age)
      .slice(0, 5);

    const activeCouplesCount = couples.filter(
      (c) => c.link.status === 'married' || c.link.status === 'partner'
    ).length;

    return {
      total,
      living,
      deceased,
      male,
      female,
      genList,
      branchList,
      upcomingBirthdays,
      upcomingAnniversaries,
      eldestLiving,
      activeCouplesCount,
      maxGen: genList.length > 0 ? genList[genList.length - 1][0] : 0,
    };
  }, [members, generationMap, couples]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F4] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Clan Hero Banner */}
        <div className="bg-gradient-to-br from-[#1C2B26] via-[#243B33] to-[#2E5447] text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 text-[#D5EAE1] text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              แดชบอร์ดสรุปภาพรวมและคู่ครอบครัว
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif-thai">{data.clanName}</h2>
            {data.motto && <p className="text-sm text-[#D5E3DD] mt-2">{data.motto}</p>}
          </div>
          <div className="absolute -right-10 -bottom-10 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* Summary KPI Cards (5 cards on desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-white rounded-2xl p-4 border border-[#E5DFD5] shadow-xs">
            <div className="flex items-center justify-between text-[#7C8782] mb-2">
              <span className="text-xs font-medium">สมาชิกทั้งหมด</span>
              <Users className="w-4 h-4 text-[#2E6254]" />
            </div>
            <div className="text-2xl font-bold text-[#1C2B26]">{stats.total} คน</div>
            <div className="text-[11px] text-[#7C8782] mt-1">
              ชาย {stats.male} · หญิง {stats.female}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E5DFD5] shadow-xs">
            <div className="flex items-center justify-between text-[#7C8782] mb-2">
              <span className="text-xs font-medium">คู่ครอบครัว</span>
              <Home className="w-4 h-4 text-[#B5653B]" />
            </div>
            <div className="text-2xl font-bold text-[#1C2B26]">{couples.length} คู่</div>
            <div className="text-[11px] text-[#7C8782] mt-1">
              สมรส/คู่ชีวิต {stats.activeCouplesCount} คู่
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E5DFD5] shadow-xs">
            <div className="flex items-center justify-between text-[#7C8782] mb-2">
              <span className="text-xs font-medium">ยังมีชีวิต</span>
              <Heart className="w-4 h-4 text-[#B5653B]" />
            </div>
            <div className="text-2xl font-bold text-[#1C2B26]">{stats.living} คน</div>
            <div className="text-[11px] text-[#7C8782] mt-1">ผู้ล่วงลับ {stats.deceased} คน</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E5DFD5] shadow-xs">
            <div className="flex items-center justify-between text-[#7C8782] mb-2">
              <span className="text-xs font-medium">จำนวนรุ่น</span>
              <Layers className="w-4 h-4 text-[#2E6254]" />
            </div>
            <div className="text-2xl font-bold text-[#1C2B26]">{stats.maxGen} รุ่น</div>
            <div className="text-[11px] text-[#7C8782] mt-1">สืบสานจากรุ่นสู่รุ่น</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E5DFD5] shadow-xs col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-[#7C8782] mb-2">
              <span className="text-xs font-medium">สายตระกูล / บ้าน</span>
              <GitBranch className="w-4 h-4 text-[#B5653B]" />
            </div>
            <div className="text-2xl font-bold text-[#1C2B26]">{stats.branchList.length} สาย</div>
            <div className="text-[11px] text-[#7C8782] mt-1 truncate">
              {stats.branchList
                .slice(0, 2)
                .map(([name]) => name)
                .join(', ')}
            </div>
          </div>
        </div>

        {/* FAMILY COUPLES DASHBOARD SECTION */}
        <section className="bg-white rounded-2xl p-5 border border-[#E5DFD5] shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#1C2B26] font-serif-thai flex items-center gap-2">
                <Home className="w-4 h-4 text-[#B5653B]" />
                ทำเนียบสรุปแต่ละคู่ครอบครัว ({couples.length} บ้าน)
              </h3>
              <p className="text-xs text-[#64716C] mt-0.5">
                ดูสรุปวันแต่งงาน ที่อยู่บ้าน บุตรเรียงตามลำดับพี่น้อง และกดปุ่มตั้งค่าเพื่อปรับรายละเอียดของแต่ละคู่ได้ทันที
              </p>
            </div>
          </div>

          {couples.length === 0 ? (
            <p className="text-xs text-[#7C8782] py-6 text-center">
              ยังไม่มีคู่สมรสในผังตระกูล (คลิกที่สมาชิกแล้วกด "เพิ่มคู่สมรส" เพื่อเริ่มสร้างครอบครัว)
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {couples.map((unit) => {
                const gen = generationMap[unit.personA.id];
                const yearsMarried =
                  unit.link.status === 'married' || unit.link.status === 'partner'
                    ? calculateYearsSince(unit.link.marriageDate)
                    : null;
                const badge = STATUS_BADGE[unit.link.status];
                const title =
                  unit.link.familyName ||
                  `ครอบครัว ${unit.personA.nickname || unit.personA.firstName} & ${unit.personB.nickname || unit.personB.firstName}`;

                return (
                  <div
                    key={unit.id}
                    style={{ borderLeftColor: unit.color }}
                    className="p-4 rounded-2xl border border-[#E5DFD5] border-l-4 bg-[#FAF8F4] hover:border-[#2E6254] transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2.5">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center -space-x-2 shrink-0">
                            <PersonAvatar person={unit.personA} size="sm" />
                            <PersonAvatar person={unit.personB} size="sm" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                style={{ backgroundColor: unit.color }}
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                title="สีประจำครอบครัว"
                              />
                              {gen != null && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-[#E5DFD5] text-[#53615C]">
                                  รุ่น {gen}
                                </span>
                              )}
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-[#1C2B26] truncate mt-0.5">
                              {title}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenCoupleDetail(unit.personA.id, unit.personB.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#DDD6CA] hover:border-[#2E6254] text-[11px] font-medium text-[#2E6254] shrink-0 transition-colors cursor-pointer"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          {canEdit ? 'ตั้งค่าคู่' : 'รายละเอียด'}
                        </button>
                      </div>

                      {/* Partner names & metadata */}
                      <div className="text-xs text-[#53615C] space-y-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectPerson(unit.personA.id)}
                            className="font-medium text-[#1C2B26] hover:underline cursor-pointer"
                          >
                            {getDisplayNameWithNickname(unit.personA)}
                          </button>
                          <Heart className="w-3 h-3 text-[#B5653B] fill-[#B5653B] inline mx-0.5" />
                          <button
                            type="button"
                            onClick={() => onSelectPerson(unit.personB.id)}
                            className="font-medium text-[#1C2B26] hover:underline cursor-pointer"
                          >
                            {getDisplayNameWithNickname(unit.personB)}
                          </button>
                        </div>

                        {unit.link.marriageDate && (
                          <div className="text-[11px] text-[#7C8782] flex items-center gap-1.5">
                            <CalendarHeart className="w-3.5 h-3.5 text-[#B5653B] shrink-0" />
                            <span>
                              สมรส {formatThaiDate(unit.link.marriageDate)}
                              {yearsMarried != null && ` (ครองคู่ ${yearsMarried} ปี)`}
                            </span>
                          </div>
                        )}

                        {(unit.link.residence || unit.personA.address) && (
                          <div className="text-[11px] text-[#7C8782] flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{unit.link.residence || unit.personA.address}</span>
                          </div>
                        )}

                        {unit.link.note && (
                          <p className="text-[11px] text-[#64716C] italic line-clamp-2 pt-0.5">
                            "{unit.link.note}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Children pills ordered by birthOrder */}
                    <div className="pt-2.5 border-t border-[#EAE4DA]">
                      <div className="text-[11px] font-medium text-[#7C8782] mb-1.5">
                        บุตร ({unit.children.length} คน)
                      </div>
                      {unit.children.length === 0 ? (
                        <span className="text-[11px] text-[#9A948A]">ยังไม่มีบุตร</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {unit.children.map((child, idx) => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => onSelectPerson(child.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#E5DFD5] hover:border-[#2E6254] text-[11px] text-[#1C2B26] transition-colors cursor-pointer"
                            >
                              <span className="w-4 h-4 rounded-full bg-[#2E6254] text-white text-[10px] font-bold flex items-center justify-center">
                                {child.birthOrder ?? idx + 1}
                              </span>
                              <span>{child.nickname || child.firstName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Two-column detailed widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upcoming Birthdays */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5DFD5] shadow-xs space-y-3.5">
            <h3 className="text-sm font-semibold text-[#1C2B26] flex items-center gap-2">
              <Cake className="w-4 h-4 text-[#B5653B]" />
              วันเกิดที่ใกล้จะถึง (ภายใน 90 วัน)
            </h3>
            {stats.upcomingBirthdays.length === 0 ? (
              <p className="text-xs text-[#7C8782] py-4">
                ยังไม่มีวันเกิดของสมาชิกในช่วง 90 วันข้างหน้า (หรือยังไม่ได้ระบุวันเกิด)
              </p>
            ) : (
              <div className="divide-y divide-[#F3EFE8]">
                {stats.upcomingBirthdays.map(({ person, days, age }) => (
                  <button
                    key={person.id}
                    onClick={() => onSelectPerson(person.id)}
                    className="w-full py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F4] px-2 -mx-2 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PersonAvatar person={person} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#1C2B26] truncate">
                          {getDisplayNameWithNickname(person)}
                        </div>
                        <div className="text-[11px] text-[#7C8782]">
                          {formatThaiDate(person.birthDate)}
                          {age != null && ` · จะครบ ${age + (days === 0 ? 0 : 1)} ปี`}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                        days === 0
                          ? 'bg-[#B5653B] text-white'
                          : days <= 14
                            ? 'bg-[#F8E7DE] text-[#9A4E28]'
                            : 'bg-[#F2EEE7] text-[#53615C]'
                      }`}
                    >
                      {days === 0 ? 'วันนี้!' : `อีก ${days} วัน`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Wedding Anniversaries */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5DFD5] shadow-xs space-y-3.5">
            <h3 className="text-sm font-semibold text-[#1C2B26] flex items-center gap-2">
              <CalendarHeart className="w-4 h-4 text-[#B5653B]" />
              วันครบรอบแต่งงานใกล้จะถึง (ภายใน 90 วัน)
            </h3>
            {stats.upcomingAnniversaries.length === 0 ? (
              <p className="text-xs text-[#7C8782] py-4">
                ยังไม่มีวันครบรอบแต่งงานในช่วง 90 วันข้างหน้า (สามารถใส่วันแต่งงานได้ที่ปุ่ม "ตั้งค่าคู่")
              </p>
            ) : (
              <div className="divide-y divide-[#F3EFE8]">
                {stats.upcomingAnniversaries.map(({ couple, days, years }) => (
                  <button
                    key={couple.id}
                    onClick={() => onOpenCoupleDetail(couple.personA.id, couple.personB.id)}
                    className="w-full py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F4] px-2 -mx-2 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex items-center -space-x-2 shrink-0">
                        <PersonAvatar person={couple.personA} size="xs" />
                        <PersonAvatar person={couple.personB} size="xs" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#1C2B26] truncate">
                          {couple.link.familyName ||
                            `${couple.personA.nickname || couple.personA.firstName} & ${couple.personB.nickname || couple.personB.firstName}`}
                        </div>
                        <div className="text-[11px] text-[#7C8782]">
                          {formatThaiDate(couple.link.marriageDate)}
                          {years != null && ` · ครบรอบ ${years + (days === 0 ? 0 : 1)} ปี`}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                        days === 0
                          ? 'bg-[#B5653B] text-white'
                          : 'bg-[#F8E7DE] text-[#9A4E28]'
                      }`}
                    >
                      {days === 0 ? 'วันนี้!' : `อีก ${days} วัน`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generation Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5DFD5] shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-[#1C2B26] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2E6254]" />
              สัดส่วนสมาชิกแต่ละรุ่น
            </h3>
            <div className="space-y-3">
              {stats.genList.map(([gen, count]) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={gen} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#31403B]">รุ่นที่ {gen}</span>
                      <span className="text-[#64716C]">
                        {count} คน ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#F2EEE7] overflow-hidden">
                      <div
                        style={{ width: `${Math.max(6, pct)}%` }}
                        className="h-full rounded-full bg-[#2E6254]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Branch Breakdown & Eldest */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5DFD5] shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-[#1C2B26] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#2E6254]" />
              ผู้อาวุโสในตระกูล (ยังมีชีวิต)
            </h3>
            {stats.eldestLiving.length === 0 ? (
              <p className="text-xs text-[#7C8782] py-4">ยังไม่ได้ระบุวันเกิดของสมาชิก</p>
            ) : (
              <div className="divide-y divide-[#F3EFE8]">
                {stats.eldestLiving.map(({ person, age }) => (
                  <button
                    key={person.id}
                    onClick={() => onSelectPerson(person.id)}
                    className="w-full py-2 flex items-center justify-between gap-3 hover:bg-[#FAF8F4] px-2 -mx-2 rounded-xl transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PersonAvatar person={person} size="sm" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#1C2B26] truncate">
                          {getDisplayNameWithNickname(person)}
                        </div>
                        <div className="text-[11px] text-[#7C8782]">
                          {person.branch || 'สมาชิกตระกูล'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#2E6254] bg-[#E9F2EE] px-2.5 py-1 rounded-full shrink-0">
                      {age} ปี
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
