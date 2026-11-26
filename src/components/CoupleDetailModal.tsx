import React, { useMemo, useState } from 'react';
import {
  X,
  Heart,
  Home,
  Calendar,
  MapPin,
  Save,
  Users,
  ArrowUp,
  ArrowDown,
  StickyNote,
} from 'lucide-react';
import { FamilyTreeData, SpouseStatus } from '../types/family';
import { ThemePalette } from '../utils/themes';
import {
  getCoupleUnits,
  getDisplayNameWithNickname,
  getSiblingRankInfo,
} from '../utils/familyOps';
import { calculateYearsSince, formatThaiDate } from '../utils/dateUtils';
import { PersonAvatar } from './PersonAvatar';

interface CoupleDetailModalProps {
  data: FamilyTreeData;
  personAId: string;
  personBId: string;
  palette: ThemePalette;
  canEdit?: boolean;
  onClose: () => void;
  onSaveDetails: (
    personAId: string,
    personBId: string,
    details: {
      status: SpouseStatus;
      familyName?: string;
      marriageDate?: string;
      marriagePlace?: string;
      residence?: string;
      note?: string;
    }
  ) => void;
  onReorderChildren: (orderedChildIds: string[]) => void;
  onSelectPerson: (personId: string) => void;
}

const STATUS_LABELS: Record<SpouseStatus, string> = {
  married: 'สมรส / คู่ชีวิต',
  partner: 'อยู่กินฉันสามีภรรยา',
  divorced: 'หย่าร้าง / แยกทาง',
  widowed: 'คู่สมรสผู้ล่วงลับ',
};

export const CoupleDetailModal: React.FC<CoupleDetailModalProps> = ({
  data,
  personAId,
  personBId,
  palette,
  canEdit = true,
  onClose,
  onSaveDetails,
  onReorderChildren,
  onSelectPerson,
}) => {
  const unit = useMemo(() => {
    const all = getCoupleUnits(data.members);
    const pairKey = [personAId, personBId].sort().join('::');
    return all.find((u) => u.id === pairKey) ?? null;
  }, [data.members, personAId, personBId]);

  const [status, setStatus] = useState<SpouseStatus>(unit?.link.status ?? 'married');
  const [familyName, setFamilyName] = useState(unit?.link.familyName || '');
  const [marriageDate, setMarriageDate] = useState(unit?.link.marriageDate || '');
  const [marriagePlace, setMarriagePlace] = useState(unit?.link.marriagePlace || '');
  const [residence, setResidence] = useState(unit?.link.residence || '');
  const [note, setNote] = useState(unit?.link.note || '');

  if (!unit) return null;

  const { personA, personB, children } = unit;
  const yearsMarried =
    status === 'married' || status === 'partner'
      ? calculateYearsSince(marriageDate || unit.link.marriageDate)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    onSaveDetails(personA.id, personB.id, {
      status,
      familyName,
      marriageDate,
      marriagePlace,
      residence,
      note,
    });
    onClose();
  };

  const moveChild = (idx: number, direction: -1 | 1) => {
    if (!canEdit) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= children.length) return;
    const nextOrder = children.map((c) => c.id);
    const [moved] = nextOrder.splice(idx, 1);
    nextOrder.splice(targetIdx, 0, moved);
    onReorderChildren(nextOrder);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: palette.bgSurface,
          borderColor: palette.border,
          color: palette.textMain,
        }}
        className="w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Couple Avatars */}
        <div
          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
          className="px-6 py-4 border-b flex items-start justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center -space-x-2 shrink-0">
              <PersonAvatar person={personA} size="md" />
              <PersonAvatar person={personB} size="md" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base font-bold font-serif-thai truncate">
                  {familyName.trim() ||
                    `ครอบครัว ${personA.nickname || personA.firstName} & ${personB.nickname || personB.firstName}`}
                </h2>
              </div>
              <p style={{ color: palette.textMuted }} className="text-xs truncate">
                {getDisplayNameWithNickname(personA)} · {getDisplayNameWithNickname(personB)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: palette.textMuted }}
            className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Quick Couple Summary Pill */}
          <div
            style={{ backgroundColor: palette.accentSoft, borderColor: palette.border }}
            className="px-4 py-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-2 font-semibold" style={{ color: palette.accent }}>
              <Heart className="w-4 h-4 fill-current" />
              <span>{STATUS_LABELS[status]}</span>
              {marriageDate && (
                <span>
                  · {formatThaiDate(marriageDate)}
                  {yearsMarried != null && ` (ครบรอบ ${yearsMarried} ปี)`}
                </span>
              )}
            </div>
            <span style={{ color: palette.textMuted }} className="font-medium">
              บุตร {children.length} คน
            </span>
          </div>

          {/* Household Settings Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium theme-muted-text mb-1">
                  <Home className="w-3.5 h-3.5" />
                  ชื่อบ้าน / ชื่อครอบครัว
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="เช่น บ้านบางรัก, เรือนสวนเชียงใหม่"
                  style={{ borderColor: palette.border, backgroundColor: palette.bgSurface }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none disabled:opacity-65"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium theme-muted-text mb-1">
                  <Heart className="w-3.5 h-3.5" />
                  สถานะคู่สมรส
                </label>
                <select
                  disabled={!canEdit}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SpouseStatus)}
                  style={{ borderColor: palette.border, backgroundColor: palette.bgSurface }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none disabled:opacity-65"
                >
                  <option value="married">สมรส / คู่ชีวิต</option>
                  <option value="partner">อยู่กินฉันสามีภรรยา</option>
                  <option value="divorced">หย่าร้าง / แยกทาง</option>
                  <option value="widowed">คู่สมรสผู้ล่วงลับ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium theme-muted-text mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  วันแต่งงาน / วันครบรอบ
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={marriageDate}
                  onChange={(e) => setMarriageDate(e.target.value)}
                  style={{ borderColor: palette.border, backgroundColor: palette.bgSurface }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none disabled:opacity-65"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium theme-muted-text mb-1">
                  <MapPin className="w-3.5 h-3.5" />
                  สถานที่แต่งงาน / จดทะเบียน
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={marriagePlace}
                  onChange={(e) => setMarriagePlace(e.target.value)}
                  placeholder="เช่น โรงแรมโอเรียนเต็ล, เชียงใหม่"
                  style={{ borderColor: palette.border, backgroundColor: palette.bgSurface }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none disabled:opacity-65"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium theme-muted-text mb-1">
                <MapPin className="w-3.5 h-3.5" />
                ที่อยู่หลักของครอบครัวคู่นี้
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={residence}
                onChange={(e) => setResidence(e.target.value)}
                placeholder="เช่น ซอยสีลม 9 เขตบางรัก กรุงเทพฯ"
                style={{ borderColor: palette.border, backgroundColor: palette.bgSurface }}
                className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none disabled:opacity-65"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium theme-muted-text mb-1">
                <StickyNote className="w-3.5 h-3.5" />
                บันทึก / เรื่องราวประจำครอบครัวคู่นี้
              </label>
              <textarea
                rows={3}
                disabled={!canEdit}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น รู้จักกันสมัยเรียน, วันรวมญาติประจำบ้าน, ข้อควรจำของบ้านนี้..."
                style={{ borderColor: palette.border, backgroundColor: palette.bgSurface }}
                className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none resize-y disabled:opacity-65"
              />
            </div>
          </div>

          {/* Children List with Sibling Birth Order & Quick Up/Down Reorder */}
          <div style={{ borderColor: palette.border }} className="pt-4 border-t space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4" style={{ color: palette.primary }} />
                บุตรของคู่นี้ เรียงตามลำดับพี่น้อง ({children.length} คน)
              </h4>
              {canEdit && children.length > 1 && (
                <span style={{ color: palette.textMuted }} className="text-[11px]">
                  กดลูกศรเพื่อสลับลำดับพี่น้อง
                </span>
              )}
            </div>

            {children.length === 0 ? (
              <p style={{ color: palette.textMuted }} className="text-xs py-2">
                ยังไม่มีข้อมูลบุตรของคู่นี้
              </p>
            ) : (
              <div className="space-y-1.5">
                {children.map((child, idx) => {
                  const rank = getSiblingRankInfo(data.members, child.id);
                  return (
                    <div
                      key={child.id}
                      style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPerson(child.id);
                          onClose();
                        }}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer hover:opacity-80"
                      >
                        <span
                          style={{ backgroundColor: palette.primary, color: '#fff' }}
                          className="w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0"
                        >
                          {idx + 1}
                        </span>
                        <PersonAvatar person={child} size="xs" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">
                            {getDisplayNameWithNickname(child)}
                          </div>
                          <div style={{ color: palette.textMuted }} className="text-[10.5px]">
                            {rank?.label || `บุตรคนที่ ${idx + 1}`}
                            {child.birthDate ? ` · เกิด ${formatThaiDate(child.birthDate)}` : ''}
                          </div>
                        </div>
                      </button>

                      {canEdit && children.length > 1 && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveChild(idx, -1)}
                            title="เลื่อนขึ้นเป็นพี่"
                            className="p-1 rounded-lg hover:bg-black/10 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === children.length - 1}
                            onClick={() => moveChild(idx, 1)}
                            title="เลื่อนลงเป็นน้อง"
                            className="p-1 rounded-lg hover:bg-black/10 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ borderColor: palette.border }} className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              style={{ color: palette.textMuted }}
              className="px-4 py-2 text-xs font-medium rounded-xl hover:bg-black/5 cursor-pointer"
            >
              {canEdit ? 'ยกเลิก' : 'ปิด'}
            </button>
            {canEdit && (
              <button
                type="submit"
                style={{ backgroundColor: palette.primary }}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-sm hover:opacity-90 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                บันทึกรายละเอียดคู่ครอบครัว
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
