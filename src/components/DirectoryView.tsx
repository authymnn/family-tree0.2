import React, { useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Download,
  MapPin,
  Phone,
  GitBranch,
  Eye,
  Filter,
} from 'lucide-react';
import { FamilyTreeData, Person } from '../types/family';
import { calculateAge, formatThaiDate } from '../utils/dateUtils';
import { getFullName } from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';

interface DirectoryViewProps {
  data: FamilyTreeData;
  generationMap: Record<string, number>;
  branches: string[];
  canEdit?: boolean;
  onSelectAndInspect: (personId: string) => void;
  onJumpToTree: (personId: string) => void;
  onAddStandalone: () => void;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  data,
  generationMap,
  branches,
  canEdit = true,
  onSelectAndInspect,
  onJumpToTree,
  onAddStandalone,
}) => {
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [genFilter, setGenFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVING' | 'DECEASED'>('ALL');
  const [sortBy, setSortBy] = useState<'generation' | 'name' | 'age'>('generation');

  const generations = useMemo(() => {
    const set = new Set<number>(Object.values(generationMap));
    return Array.from(set).sort((a, b) => a - b);
  }, [generationMap]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Object.values(data.members).filter((m) => {
      if (branchFilter !== 'ALL' && (m.branch || 'ไม่ระบุสาย') !== branchFilter) return false;
      if (genFilter !== 'ALL' && String(generationMap[m.id] ?? 0) !== genFilter) return false;
      if (statusFilter === 'LIVING' && m.isDeceased) return false;
      if (statusFilter === 'DECEASED' && !m.isDeceased) return false;
      if (!q) return true;
      return (
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        (m.nickname || '').toLowerCase().includes(q) ||
        (m.occupation || '').toLowerCase().includes(q) ||
        (m.address || '').toLowerCase().includes(q) ||
        (m.branch || '').toLowerCase().includes(q) ||
        (m.phone || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      if (sortBy === 'generation') {
        const ga = generationMap[a.id] ?? 99;
        const gb = generationMap[b.id] ?? 99;
        if (ga !== gb) return ga - gb;
        return a.firstName.localeCompare(b.firstName, 'th');
      }
      if (sortBy === 'age') {
        const aa = calculateAge(a.birthDate, a.deathDate, a.isDeceased) ?? -1;
        const ab = calculateAge(b.birthDate, b.deathDate, b.isDeceased) ?? -1;
        return ab - aa;
      }
      return a.firstName.localeCompare(b.firstName, 'th');
    });
  }, [data.members, query, branchFilter, genFilter, statusFilter, sortBy, generationMap]);

  const handleExportCsv = () => {
    const headers = [
      'รุ่น',
      'คำนำหน้า',
      'ชื่อจริง',
      'นามสกุล',
      'ชื่อเล่น',
      'เพศ',
      'สถานะ',
      'วันเกิด',
      'อายุ',
      'สายตระกูล',
      'อาชีพ',
      'เบอร์โทร',
      'Line ID',
      'ที่อยู่',
      'หมายเหตุ',
      'ประวัติย่อ',
    ];
    const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const rows = filteredMembers.map((m: Person) => {
      const age = calculateAge(m.birthDate, m.deathDate, m.isDeceased);
      return [
        String(generationMap[m.id] ?? ''),
        m.title || '',
        m.firstName,
        m.lastName,
        m.nickname || '',
        m.gender === 'male' ? 'ชาย' : m.gender === 'female' ? 'หญิง' : 'อื่นๆ',
        m.isDeceased ? 'ล่วงลับ' : 'ยังมีชีวิต',
        m.birthDate ? formatThaiDate(m.birthDate) : '',
        age != null ? String(age) : '',
        m.branch || '',
        m.occupation || '',
        m.phone || '',
        m.lineId || '',
        m.address || '',
        m.notes || '',
        m.bio || '',
      ]
        .map(escapeCsv)
        .join(',');
    });
    const bom = '\uFEFF'; // UTF-8 BOM so Excel opens Thai characters cleanly
    const blob = new Blob([bom + [headers.map(escapeCsv).join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(data.clanName || 'family').replace(/\s+/g, '_')}_directory.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F4] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1C2B26] font-serif-thai">
              ทะเบียนรายชื่อสมาชิกตระกูล
            </h2>
            <p className="text-xs text-[#64716C] mt-0.5">
              แสดง {filteredMembers.length} จากทั้งหมด {Object.keys(data.members).length} คน · คลิกที่รายชื่อเพื่อดูหรือแก้ไขประวัติ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DDD6CA] text-xs font-medium text-[#465550] hover:border-[#2E6254] hover:text-[#2E6254] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              ส่งออก Excel (CSV)
            </button>
            {canEdit && (
              <button
                onClick={onAddStandalone}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E6254] text-white text-xs font-medium hover:bg-[#234E42] shadow-sm transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                เพิ่มสมาชิกใหม่
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5DFD5] shadow-xs flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#8C9691] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ, ชื่อเล่น, อาชีพ, จังหวัด, เบอร์โทร..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#E5DFD5] bg-[#FAF8F4] focus:bg-white focus:outline-none focus:border-[#2E6254]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#8C9691] hidden sm:block" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-[#E5DFD5] bg-white text-[#465550] focus:outline-none focus:border-[#2E6254]"
            >
              <option value="ALL">ทุกสายตระกูล</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={genFilter}
              onChange={(e) => setGenFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-[#E5DFD5] bg-white text-[#465550] focus:outline-none focus:border-[#2E6254]"
            >
              <option value="ALL">ทุกรุ่น</option>
              {generations.map((g) => (
                <option key={g} value={String(g)}>
                  รุ่นที่ {g}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'LIVING' | 'DECEASED')}
              className="px-3 py-2 text-xs rounded-xl border border-[#E5DFD5] bg-white text-[#465550] focus:outline-none focus:border-[#2E6254]"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="LIVING">ยังมีชีวิต</option>
              <option value="DECEASED">ผู้ล่วงลับ</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'generation' | 'name' | 'age')}
              className="px-3 py-2 text-xs rounded-xl border border-[#E5DFD5] bg-white text-[#465550] focus:outline-none focus:border-[#2E6254]"
            >
              <option value="generation">เรียงตามรุ่น</option>
              <option value="age">เรียงตามอายุ (มาก→น้อย)</option>
              <option value="name">เรียงตามชื่อ ก-ฮ</option>
            </select>
          </div>
        </div>

        {/* Member Cards Grid */}
        {filteredMembers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5DFD5] py-16 text-center text-sm text-[#7C8782]">
            ไม่พบสมาชิกที่ตรงกับเงื่อนไขการค้นหา
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredMembers.map((member) => {
              const age = calculateAge(member.birthDate, member.deathDate, member.isDeceased);
              const gen = generationMap[member.id];
              return (
                <div
                  key={member.id}
                  onClick={() => onSelectAndInspect(member.id)}
                  className="group bg-white rounded-2xl border border-[#E5DFD5] hover:border-[#2E6254] p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <PersonAvatar person={member} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {gen != null && (
                          <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-[#E9F2EE] text-[#225144]">
                            รุ่น {gen}
                          </span>
                        )}
                        {member.nickname && (
                          <span className="text-[11px] font-semibold text-[#B5653B]">
                            {member.nickname}
                          </span>
                        )}
                        {member.isDeceased && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EAE6DF] text-[#645E56]">
                            ล่วงลับ
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-[#1C2B26] truncate">
                        {getFullName(member)}
                      </div>
                      <div className="text-xs text-[#64716C] truncate mt-0.5">
                        {member.occupation || 'ยังไม่ระบุอาชีพ'}
                        {age != null && (
                          <span> · {member.isDeceased ? `สิริอายุ ${age} ปี` : `${age} ปี`}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#F3EFE8] text-[11px] text-[#7C8782]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {member.branch && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <GitBranch className="w-3 h-3 shrink-0" />
                          <span className="truncate">{member.branch}</span>
                        </span>
                      )}
                      {member.phone && (
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <Phone className="w-3 h-3" />
                          {member.phone}
                        </span>
                      )}
                      {!member.phone && member.address && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{member.address}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onJumpToTree(member.id);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FAF8F4] text-[#2E6254] hover:bg-[#E3EFEA] font-medium shrink-0 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      ดูบนผัง
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
