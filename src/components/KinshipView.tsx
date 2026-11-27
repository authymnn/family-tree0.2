import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeftRight,
  Sparkles,
  GitCompare,
  Search,
  ChevronDown,
  X,
  ShieldCheck,
  ShieldAlert,
  Info,
  BookOpen,
} from 'lucide-react';
import { FamilyTreeData, Person } from '../types/family';
import { evaluateMahramStatus, findThaiKinship } from '../utils/kinship';
import { getDisplayNameWithNickname } from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';

interface KinshipViewProps {
  data: FamilyTreeData;
  onHighlightPathOnTree: (pathIds: string[], label: string) => void;
}

interface SearchableMemberPickerProps {
  label: string;
  members: Person[];
  selectedId: string;
  onSelect: (personId: string) => void;
}

const SearchableMemberPicker: React.FC<SearchableMemberPickerProps> = ({
  label,
  members,
  selectedId,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedPerson = useMemo(
    () => members.find((m) => m.id === selectedId) ?? null,
    [members, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        (m.nickname || '').toLowerCase().includes(q) ||
        (m.branch || '').toLowerCase().includes(q)
    );
  }, [members, query]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-medium text-[#53615C] mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery('');
        }}
        className={`w-full px-3 py-2 text-left rounded-xl border transition-colors flex items-center gap-2.5 cursor-pointer ${
          open
            ? 'bg-white border-[#2E6254] ring-2 ring-[#2E6254]/15'
            : 'bg-[#FAF8F4] border-[#DDD6CA] hover:bg-white'
        }`}
      >
        {selectedPerson ? (
          <>
            <PersonAvatar person={selectedPerson} size="xs" />
            <span className="text-sm font-medium text-[#1C2B26] truncate flex-1">
              {getDisplayNameWithNickname(selectedPerson)}
            </span>
          </>
        ) : (
          <span className="text-sm text-[#8C8477] flex-1">เลือกสมาชิก...</span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#E9F2EE] text-[#225144] text-[11px] font-semibold shrink-0">
          <Search className="w-3 h-3" />
          ค้นหา
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#7C8782] shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[#DDD6CA] shadow-xl z-40 overflow-hidden animate-fade-in">
          <div className="p-2.5 border-b border-[#EFEAE1] bg-[#FAF8F4]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7C8782] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="พิมพ์ชื่อ, ชื่อเล่น หรือนามสกุล..."
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-[#DDD6CA] bg-white focus:outline-none focus:border-[#2E6254]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7C8782] hover:text-[#1C2B26] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-[#F3EFE8]">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[#7C8782]">
                ไม่พบรายชื่อที่ตรงกับ &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((m) => {
                const isSelected = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelect(m.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full px-3 py-2 flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#E9F2EE]' : 'hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <PersonAvatar person={m} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#1C2B26] truncate">
                        {getDisplayNameWithNickname(m)}
                      </div>
                      <div className="text-[10.5px] text-[#7C8782] truncate">
                        {[
                          m.gender === 'male' ? 'ชาย' : m.gender === 'female' ? 'หญิง' : null,
                          m.branch,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'สมาชิกในผัง'}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-[#225144] shrink-0">เลือกอยู่</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const KinshipView: React.FC<KinshipViewProps> = ({ data, onHighlightPathOnTree }) => {
  const sortedMembers = useMemo(
    () =>
      Object.values(data.members).sort((a, b) =>
        a.firstName.localeCompare(b.firstName, 'th')
      ),
    [data.members]
  );

  const [personAId, setPersonAId] = useState<string>(sortedMembers[sortedMembers.length - 1]?.id || '');
  const [personBId, setPersonBId] = useState<string>(sortedMembers[0]?.id || '');
  const [showMahramGuide, setShowMahramGuide] = useState(false);

  // Keep valid selection if members change
  useEffect(() => {
    if (sortedMembers.length >= 2) {
      if (!data.members[personAId]) setPersonAId(sortedMembers[sortedMembers.length - 1].id);
      if (!data.members[personBId]) setPersonBId(sortedMembers[0].id);
    }
  }, [data.members, sortedMembers, personAId, personBId]);

  const result = useMemo(() => {
    if (!personAId || !personBId) return null;
    return findThaiKinship(data.members, personAId, personBId);
  }, [data.members, personAId, personBId]);

  const mahram = useMemo(() => {
    if (!personAId || !personBId) return null;
    return evaluateMahramStatus(data.members, personAId, personBId);
  }, [data.members, personAId, personBId]);

  const personA = data.members[personAId];
  const personB = data.members[personBId];

  const handleSwap = () => {
    setPersonAId(personBId);
    setPersonBId(personAId);
  };

  if (sortedMembers.length < 2) {
    return (
      <div className="flex-1 bg-[#FAF8F4] flex items-center justify-center p-8 text-center text-sm text-[#7C8782]">
        ต้องมีสมาชิกในผังตระกูลอย่างน้อย 2 คน เพื่อคำนวณความสัมพันธ์
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F4] p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E9F2EE] text-[#225144] text-xs font-semibold">
            <GitCompare className="w-3.5 h-3.5" />
            ระบบลำดับญาติ & ตรวจสอบมะฮ์รอม
          </div>
          <h2 className="text-2xl font-bold text-[#1C2B26] font-serif-thai">
            คำนวณความสัมพันธ์ในตระกูล
          </h2>
          <p className="text-xs text-[#64716C]">
            ค้นหาและเลือกสมาชิก 2 คน เพื่อดูลำดับญาติ พร้อมตรวจสอบสถานะมะฮ์รอม (การสัมผัสตัว)
          </p>
        </div>

        {/* Searchable Selector Panel */}
        <div className="bg-white p-5 rounded-2xl border border-[#E5DFD5] shadow-sm grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <SearchableMemberPicker
            label="มุมมองของ (บุคคลที่ 1)"
            members={sortedMembers}
            selectedId={personAId}
            onSelect={setPersonAId}
          />

          <button
            type="button"
            onClick={handleSwap}
            title="สลับฝั่ง"
            className="mx-auto p-2.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD5] text-[#465550] hover:bg-[#E9F2EE] hover:text-[#2E6254] transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <SearchableMemberPicker
            label="อยากรู้ว่าคนนี้เป็นอะไร (บุคคลที่ 2)"
            members={sortedMembers}
            selectedId={personBId}
            onSelect={setPersonBId}
          />
        </div>

        {/* Result Card */}
        {result && personA && personB && (
          <div className="bg-white rounded-2xl border border-[#E5DFD5] shadow-sm overflow-hidden">
            <div className="p-6 text-center bg-gradient-to-b from-[#FAF8F4] to-white border-b border-[#EFEAE1]">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="flex flex-col items-center gap-1">
                  <PersonAvatar person={personA} size="lg" />
                  <span className="text-xs font-medium text-[#465550]">
                    {personA.nickname || personA.firstName}
                  </span>
                </div>
                <ArrowRight className="w-5 h-5 text-[#B5653B]" />
                <div className="flex flex-col items-center gap-1">
                  <PersonAvatar person={personB} size="lg" />
                  <span className="text-xs font-medium text-[#465550]">
                    {personB.nickname || personB.firstName}
                  </span>
                </div>
              </div>

              <div className="text-xs text-[#7C8782] mb-1">
                {personB.nickname || personB.firstName} มีศักดิ์เป็น
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#2E6254] font-serif-thai">
                {result.title}
              </div>
              <p className="text-sm text-[#53615C] mt-2">{result.explanation}</p>

              {/* Islamic Mahram Status Card */}
              {mahram && mahram.category !== 'self' && (
                <div
                  className={`mt-5 text-left rounded-2xl border p-4 space-y-2 ${
                    mahram.canTouch
                      ? 'bg-[#EEF8F3] border-[#BBE0CE] text-[#174A38]'
                      : 'bg-[#FDF1F0] border-[#F0C5BF] text-[#8A261C]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2">
                      {mahram.canTouch ? (
                        <ShieldCheck className="w-5 h-5 text-[#1F7A5A] shrink-0" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-[#C0392B] shrink-0" />
                      )}
                      <span className="text-sm font-bold">
                        {mahram.canTouch ? '✓ ' : '✕ '}
                        {mahram.touchSummary}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        mahram.canTouch
                          ? 'bg-[#1F7A5A] text-white'
                          : 'bg-[#C0392B] text-white'
                      }`}
                    >
                      {mahram.badgeText}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed opacity-95">{mahram.reason}</p>

                  {mahram.detailNote && (
                    <p
                      className={`text-[11.5px] leading-relaxed rounded-xl px-3 py-2 ${
                        mahram.canTouch ? 'bg-white/75 text-[#225144]' : 'bg-white/80 text-[#7A2319]'
                      }`}
                    >
                      {mahram.detailNote}
                    </p>
                  )}

                  {mahram.genderUncertain && (
                    <p className="text-[11px] font-medium bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2">
                      * ยังไม่ได้ระบุเพศของสมาชิกบางคนในผัง ผลลัพธ์ด้านบนอ้างอิงกรณีต่างเพศ (หากเป็นเพศเดียวกันสามารถแตะต้องตัวกันได้ตามปกติ)
                    </p>
                  )}

                  <div className="pt-1 flex items-start gap-1.5 text-[11px] opacity-80">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{mahram.milkNote}</span>
                  </div>
                </div>
              )}

              {result.found && result.pathIds.length > 1 && (
                <button
                  onClick={() =>
                    onHighlightPathOnTree(
                      result.pathIds,
                      `${personA.nickname || personA.firstName} → ${personB.nickname || personB.firstName} (${result.title})`
                    )
                  }
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B5653B] text-white text-xs font-medium hover:bg-[#994F29] shadow-sm transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  ไฮไลต์เส้นทางสายสัมพันธ์บนผังตระกูล
                </button>
              )}
            </div>

            {/* Step-by-step Chain */}
            {result.steps.length > 0 && (
              <div className="p-5 border-b border-[#EFEAE1]">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#8C8477] mb-3">
                  เส้นทางความเชื่อมโยง ({result.steps.length} ขั้น)
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD5]">
                    <PersonAvatar person={personA} size="xs" />
                    <span className="text-xs font-medium text-[#1C2B26]">
                      {personA.nickname || personA.firstName}
                    </span>
                  </div>
                  {result.steps.map((step, idx) => {
                    const target = data.members[step.toId];
                    if (!target) return null;
                    return (
                      <React.Fragment key={idx}>
                        <div className="flex items-center gap-1 text-[11px] text-[#B5653B] font-medium px-1.5">
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>{step.label}</span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD5]">
                          <PersonAvatar person={target} size="xs" />
                          <span className="text-xs font-medium text-[#1C2B26]">
                            {target.nickname || target.firstName}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collapsible Mahram Quick Reference */}
            <div className="px-5 py-3.5 bg-[#FAF8F4]/70">
              <button
                type="button"
                onClick={() => setShowMahramGuide((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-semibold text-[#465550] hover:text-[#2E6254] cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#2E6254]" />
                  หลักเกณฑ์มะฮ์รอมฉบับย่อ (ใครเป็น / ใครไม่ใช่มะฮ์รอม)
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showMahramGuide ? 'rotate-180' : ''}`}
                />
              </button>

              {showMahramGuide && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-[#EEF8F3] border border-[#CBE6D8] p-3.5 space-y-1.5 text-[#174A38]">
                    <div className="font-bold">✓ ผู้ที่เป็นมะฮ์รอม (แตะต้องตัวได้)</div>
                    <ul className="space-y-1 list-disc pl-4 text-[11.5px] leading-relaxed">
                      <li>
                        <strong>ทางสายเลือด:</strong> พ่อแม่, ปู่ย่าตายาย, ลูกหลาน, พี่น้องร่วมพ่อแม่ (หรือร่วมพ่อ/แม่), ลุง ป้า น้า อา และหลานของพี่น้อง
                      </li>
                      <li>
                        <strong>ทางการแต่งงาน:</strong> คู่สมรส, พ่อตาแม่ยาย, พ่อสามีแม่สามี, ลูกเขยลูกสะใภ้, พ่อเลี้ยงแม่เลี้ยง และลูกเลี้ยง (เมื่อสมรสสมบูรณ์แล้ว)
                      </li>
                      <li>
                        <strong>ทางการให้นม:</strong> แม่นมและเครือญาติของแม่นม (เมื่อดื่มนมครบตามเงื่อนไขศาสนา)
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl bg-[#FDF1F0] border border-[#F0C5BF] p-3.5 space-y-1.5 text-[#8A261C]">
                    <div className="font-bold">✕ ผู้ที่ &ldquo;ไม่ใช่&rdquo; มะฮ์รอม (มักเข้าใจผิดบ่อย)</div>
                    <ul className="space-y-1 list-disc pl-4 text-[11.5px] leading-relaxed">
                      <li>
                        <strong>ลูกพี่ลูกน้อง</strong> (ลูกของลุง ป้า น้า อา) และลูกหลานของลูกพี่ลูกน้อง
                      </li>
                      <li>
                        <strong>พี่เขย น้องเขย พี่สะใภ้ น้องสะใภ้</strong> (คู่สมรสของพี่น้องเรา หรือพี่น้องของคู่สมรสเรา)
                      </li>
                      <li>
                        <strong>คู่สมรสของลุง ป้า น้า อา</strong> (ลุงเขย ป้าสะใภ้ น้าเขย อาสะใภ้ ที่ไม่ได้เป็นญาติสายเลือด)
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
