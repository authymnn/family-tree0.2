import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowLeftRight, Sparkles, GitCompare } from 'lucide-react';
import { FamilyTreeData } from '../types/family';
import { findThaiKinship } from '../utils/kinship';
import { getDisplayNameWithNickname } from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';

interface KinshipViewProps {
  data: FamilyTreeData;
  onHighlightPathOnTree: (pathIds: string[], label: string) => void;
}

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

  const result = useMemo(() => {
    if (!personAId || !personBId) return null;
    return findThaiKinship(data.members, personAId, personBId);
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
            ระบบลำดับญาติภาษาไทย
          </div>
          <h2 className="text-2xl font-bold text-[#1C2B26] font-serif-thai">
            คำนวณความสัมพันธ์ในตระกูล
          </h2>
          <p className="text-xs text-[#64716C]">
            เลือกสมาชิก 2 คน เพื่อดูลำดับญาติ (เช่น ปู่ ย่า ตา ยาย ลุง ป้า น้า อา ลูกพี่ลูกน้อง สะใภ้ เขย)
          </p>
        </div>

        {/* Selector Panel */}
        <div className="bg-white p-5 rounded-2xl border border-[#E5DFD5] shadow-sm grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-[#53615C] mb-1.5">
              มุมมองของ (บุคคลที่ 1)
            </label>
            <select
              value={personAId}
              onChange={(e) => setPersonAId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#DDD6CA] bg-[#FAF8F4] focus:bg-white focus:outline-none focus:border-[#2E6254]"
            >
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {getDisplayNameWithNickname(m)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            title="สลับฝั่ง"
            className="mx-auto p-2.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD5] text-[#465550] hover:bg-[#E9F2EE] hover:text-[#2E6254] transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div>
            <label className="block text-xs font-medium text-[#53615C] mb-1.5">
              อยากรู้ว่าคนนี้เป็นอะไร (บุคคลที่ 2)
            </label>
            <select
              value={personBId}
              onChange={(e) => setPersonBId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[#DDD6CA] bg-[#FAF8F4] focus:bg-white focus:outline-none focus:border-[#2E6254]"
            >
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {getDisplayNameWithNickname(m)}
                </option>
              ))}
            </select>
          </div>
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
              <div className="p-5">
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
          </div>
        )}
      </div>
    </div>
  );
};
