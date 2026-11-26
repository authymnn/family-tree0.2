import React, { useMemo } from 'react';
import {
  Users,
  Heart,
  Layers,
  Cake,
  GitBranch,
  Award,
  Sparkles,
} from 'lucide-react';
import { FamilyTreeData } from '../types/family';
import { calculateAge, daysUntilNextBirthday, formatThaiDate } from '../utils/dateUtils';
import { getDisplayNameWithNickname } from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';

interface OverviewViewProps {
  data: FamilyTreeData;
  generationMap: Record<string, number>;
  onSelectPerson: (personId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  data,
  generationMap,
  onSelectPerson,
}) => {
  const members = useMemo(() => Object.values(data.members), [data.members]);

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
      .filter((item): item is { person: typeof item.person; days: number; age: number | null } =>
        item.days !== null && item.days <= 90
      )
      .sort((a, b) => a.days - b.days)
      .slice(0, 6);

    // Eldest living members
    const eldestLiving = members
      .filter((m) => !m.isDeceased && m.birthDate)
      .map((m) => ({ person: m, age: calculateAge(m.birthDate, undefined, false) }))
      .filter((item): item is { person: typeof item.person; age: number } => item.age !== null)
      .sort((a, b) => b.age - a.age)
      .slice(0, 5);

    return {
      total,
      living,
      deceased,
      male,
      female,
      genList,
      branchList,
      upcomingBirthdays,
      eldestLiving,
      maxGen: genList.length > 0 ? genList[genList.length - 1][0] : 0,
    };
  }, [members, generationMap]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F4] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Clan Hero Banner */}
        <div className="bg-gradient-to-br from-[#1C2B26] via-[#243B33] to-[#2E5447] text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 text-[#D5EAE1] text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              สมุดบันทึกประจำตระกูล
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif-thai">{data.clanName}</h2>
            {data.motto && <p className="text-sm text-[#D5E3DD] mt-2">{data.motto}</p>}
          </div>
          <div className="absolute -right-10 -bottom-10 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
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
              <span className="text-xs font-medium">ยังมีชีวิต / ล่วงลับ</span>
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

          <div className="bg-white rounded-2xl p-4 border border-[#E5DFD5] shadow-xs">
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

        {/* Two-column detailed widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

          {/* Branch Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5DFD5] shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-[#1C2B26] flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#B5653B]" />
              สมาชิกแยกตามสายตระกูล / บ้าน
            </h3>
            <div className="space-y-3">
              {stats.branchList.map(([branch, count]) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={branch} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#31403B]">{branch}</span>
                      <span className="text-[#64716C]">
                        {count} คน ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#F2EEE7] overflow-hidden">
                      <div
                        style={{ width: `${Math.max(6, pct)}%` }}
                        className="h-full rounded-full bg-[#B5653B]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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

          {/* Eldest Living Members */}
          <div className="bg-white rounded-2xl p-5 border border-[#E5DFD5] shadow-xs space-y-3.5">
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
                    className="w-full py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F4] px-2 -mx-2 rounded-xl transition-colors text-left cursor-pointer"
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
