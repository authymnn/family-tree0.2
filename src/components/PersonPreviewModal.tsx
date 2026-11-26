import React, { useState } from 'react';
import {
  X,
  Edit3,
  Heart,
  Baby,
  ArrowUp,
  Users,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Calendar,
  BookOpen,
  Sparkles,
  Crosshair,
  MessageCircle,
  GitBranch,
  StickyNote,
  Images,
  Settings2,
} from 'lucide-react';
import { FamilyTreeData, Person, PhotoItem, QuickAddRelation } from '../types/family';
import { ThemePalette } from '../utils/themes';
import {
  getChildrenOf,
  getDisplayNameWithNickname,
  getFullName,
  getMemberFamilyColor,
  getSiblingRankInfo,
  getSiblingsOf,
} from '../utils/familyOps';
import { calculateAge, formatThaiDate } from '../utils/dateUtils';
import { PersonAvatar } from './PersonAvatar';

interface PersonPreviewModalProps {
  data: FamilyTreeData;
  person: Person;
  generation?: number;
  palette: ThemePalette;
  canEdit: boolean;
  isLineageHighlighted: boolean;
  onClose: () => void;
  onOpenFullEditor: (personId: string) => void;
  onSelectPerson: (personId: string) => void;
  onOpenCoupleDetail: (personAId: string, personBId: string) => void;
  onQuickAdd: (anchorId: string, relation: QuickAddRelation) => void;
  onToggleLineageHighlight: (personId: string) => void;
  onFocusSubtree: (personId: string) => void;
}

export const PersonPreviewModal: React.FC<PersonPreviewModalProps> = ({
  data,
  person,
  generation,
  palette,
  canEdit,
  isLineageHighlighted,
  onClose,
  onOpenFullEditor,
  onSelectPerson,
  onOpenCoupleDetail,
  onQuickAdd,
  onToggleLineageHighlight,
  onFocusSubtree,
}) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);

  const parents = person.parentIds.map((id) => data.members[id]).filter(Boolean);
  const children = getChildrenOf(data.members, person.id);
  const siblings = getSiblingsOf(data.members, person.id);
  const siblingRank = getSiblingRankInfo(data.members, person.id);
  const memberFamilyColor = getMemberFamilyColor(data.members, person.id);
  const age = calculateAge(person.birthDate, person.deathDate, person.isDeceased);
  const gallery = person.gallery ?? [];

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1.5px] flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: palette.bgSurface,
          borderColor: palette.border,
          color: palette.textMain,
        }}
        className="w-full max-w-md max-h-[88vh] rounded-3xl shadow-2xl border overflow-hidden flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div
          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
          className="px-5 py-3.5 border-b flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {generation != null && (
              <span
                style={{
                  backgroundColor: `${memberFamilyColor}1F`,
                  color: memberFamilyColor,
                  border: `1px solid ${memberFamilyColor}44`,
                }}
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
              >
                รุ่นที่ {generation}
              </span>
            )}
            {siblingRank && (
              <span
                style={{ backgroundColor: memberFamilyColor, color: '#ffffff' }}
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-2xs"
              >
                {siblingRank.label}
              </span>
            )}
            {person.isDeceased && (
              <span
                style={{ backgroundColor: palette.bgSurface, color: palette.textMuted }}
                className="text-[11px] px-2 py-0.5 rounded-full"
              >
                ผู้ล่วงลับ
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ color: palette.textMuted }}
            className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer shrink-0"
            title="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Details Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Avatar + Identity */}
          <div className="flex items-center gap-3.5">
            <PersonAvatar person={person} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                {person.nickname && (
                  <span
                    style={{ backgroundColor: palette.accentSoft, color: palette.accent }}
                    className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                  >
                    {person.nickname}
                  </span>
                )}
                {person.branch && (
                  <span
                    style={{ backgroundColor: palette.bgSubtle, color: palette.textMuted }}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                  >
                    <GitBranch className="w-2.5 h-2.5" />
                    {person.branch}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold font-serif-thai leading-snug">
                {getFullName(person)}
              </h3>
              {person.maidenName && (
                <div style={{ color: palette.textMuted }} className="text-xs">
                  นามสกุลเดิม: {person.maidenName}
                </div>
              )}
              <div style={{ color: palette.textMuted }} className="text-xs mt-0.5">
                {person.gender === 'male' ? 'ชาย' : person.gender === 'female' ? 'หญิง' : 'ไม่ระบุเพศ'}
                {age != null && ` · ${person.isDeceased ? `สิริอายุ ${age} ปี` : `อายุ ${age} ปี`}`}
              </div>
            </div>
          </div>

          {/* Highlighted Notes Box */}
          {person.notes && (
            <div
              style={{ backgroundColor: palette.accentSoft, borderColor: palette.accent }}
              className="p-3 rounded-2xl border-l-4 space-y-1"
            >
              <div className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: palette.accent }}>
                <StickyNote className="w-3.5 h-3.5" />
                หมายเหตุประจำตัว
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-wrap">{person.notes}</p>
            </div>
          )}

          {/* Compact Details List */}
          <div className="space-y-2 text-xs">
            {person.birthDate && (
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: palette.primary }} />
                <span>
                  เกิด {formatThaiDate(person.birthDate, 'full')}
                  {person.birthPlace ? ` · จ.${person.birthPlace}` : ''}
                </span>
              </div>
            )}
            {person.isDeceased && person.deathDate && (
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: palette.textMuted }} />
                <span>ถึงแก่กรรม {formatThaiDate(person.deathDate, 'full')}</span>
              </div>
            )}
            {person.occupation && (
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-3.5 h-3.5 shrink-0" style={{ color: palette.primary }} />
                <span>{person.occupation}</span>
              </div>
            )}
            {person.education && (
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-3.5 h-3.5 shrink-0" style={{ color: palette.primary }} />
                <span>{person.education}</span>
              </div>
            )}
            {person.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: palette.primary }} />
                <a href={`tel:${person.phone}`} style={{ color: palette.primary }} className="font-semibold hover:underline">
                  {person.phone}
                </a>
              </div>
            )}
            {person.lineId && (
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-3.5 h-3.5 shrink-0" style={{ color: palette.primary }} />
                <span className="font-mono">LINE: {person.lineId}</span>
              </div>
            )}
            {person.address && (
              <div className="flex items-center gap-2.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: palette.primary }} />
                <span>{person.address}</span>
              </div>
            )}
            {person.bio && (
              <div
                style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                className="p-3 rounded-xl border mt-2 flex items-start gap-2"
              >
                <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: palette.textMuted }} />
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{person.bio}</p>
              </div>
            )}
          </div>

          {/* Mini Photo Gallery */}
          {gallery.length > 0 && (
            <div className="space-y-1.5">
              <div style={{ color: palette.textMuted }} className="text-[11px] font-semibold flex items-center gap-1">
                <Images className="w-3.5 h-3.5" />
                อัลบั้มรูป ({gallery.length})
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {gallery.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLightboxPhoto(item)}
                    className="aspect-square rounded-xl overflow-hidden border border-black/10 cursor-pointer hover:opacity-90"
                  >
                    <img src={item.url} alt={item.caption || ''} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Relatives Navigation */}
          {(parents.length > 0 || person.spouses.length > 0 || siblings.length > 0 || children.length > 0) && (
            <div style={{ borderColor: palette.border }} className="pt-3 border-t space-y-2.5">
              {parents.length > 0 && (
                <div>
                  <div style={{ color: palette.textMuted }} className="text-[10.5px] font-semibold mb-1">
                    บิดา / มารดา
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {parents.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => onSelectPerson(p.id)}
                        style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                        className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs hover:opacity-80 cursor-pointer"
                      >
                        <PersonAvatar person={p} size="xs" />
                        <span>{p.nickname || p.firstName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {person.spouses.length > 0 && (
                <div>
                  <div style={{ color: palette.textMuted }} className="text-[10.5px] font-semibold mb-1">
                    คู่สมรส
                  </div>
                  <div className="space-y-1.5">
                    {person.spouses.map((sp) => {
                      const spouse = data.members[sp.spouseId];
                      if (!spouse) return null;
                      return (
                        <div
                          key={sp.spouseId}
                          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border"
                        >
                          <button
                            onClick={() => onSelectPerson(spouse.id)}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer hover:opacity-80"
                          >
                            <PersonAvatar person={spouse} size="xs" />
                            <span className="text-xs font-medium truncate">
                              {getDisplayNameWithNickname(spouse)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenCoupleDetail(person.id, spouse.id);
                            }}
                            style={{ color: palette.primary }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline shrink-0 cursor-pointer"
                          >
                            <Settings2 className="w-3 h-3" />
                            ตั้งค่าคู่
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {children.length > 0 && (
                <div>
                  <div style={{ color: palette.textMuted }} className="text-[10.5px] font-semibold mb-1">
                    บุตร ({children.length} คน)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {children.map((c, idx) => (
                      <button
                        key={c.id}
                        onClick={() => onSelectPerson(c.id)}
                        style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                        className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border text-xs hover:opacity-80 cursor-pointer"
                      >
                        <span
                          style={{ backgroundColor: palette.primary }}
                          className="w-4 h-4 rounded-full text-white text-[9.5px] font-bold flex items-center justify-center"
                        >
                          {c.birthOrder ?? idx + 1}
                        </span>
                        <span>{c.nickname || c.firstName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Add Relatives Row (when canEdit) */}
          {canEdit && (
            <div style={{ borderColor: palette.border }} className="pt-3 border-t space-y-2">
              <div style={{ color: palette.textMuted }} className="text-[10.5px] font-semibold">
                เพิ่มญาติด่วน
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => {
                    onClose();
                    onQuickAdd(person.id, 'spouse');
                  }}
                  style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                  className="py-2 px-1 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 hover:opacity-80 cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5" style={{ color: palette.accent }} />
                  คู่สมรส
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onQuickAdd(person.id, 'child');
                  }}
                  style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                  className="py-2 px-1 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 hover:opacity-80 cursor-pointer"
                >
                  <Baby className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                  บุตร
                </button>
                <button
                  disabled={person.parentIds.length >= 2}
                  onClick={() => {
                    onClose();
                    onQuickAdd(person.id, 'parent');
                  }}
                  style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                  className="py-2 px-1 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 hover:opacity-80 disabled:opacity-40 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                  พ่อ/แม่
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onQuickAdd(person.id, 'sibling');
                  }}
                  style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                  className="py-2 px-1 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 hover:opacity-80 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" style={{ color: palette.textMuted }} />
                  พี่น้อง
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div
          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
          className="px-4 py-3 border-t flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onToggleLineageHighlight(person.id);
                onClose();
              }}
              style={
                isLineageHighlighted
                  ? { backgroundColor: palette.accent, color: '#fff' }
                  : { backgroundColor: palette.bgSurface, borderColor: palette.border }
              }
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-medium hover:opacity-85 cursor-pointer"
              title="ไฮไลต์สายตรงบรรพบุรุษและทายาท"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">สายตรง</span>
            </button>
            <button
              onClick={() => {
                onFocusSubtree(person.id);
                onClose();
              }}
              style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-medium hover:opacity-85 cursor-pointer"
              title="โฟกัสดูผังเริ่มจากคนนี้"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">โฟกัส</span>
            </button>
          </div>

          {canEdit ? (
            <button
              onClick={() => onOpenFullEditor(person.id)}
              style={{ backgroundColor: palette.primary }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-sm hover:opacity-90 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              แก้ไขข้อมูล
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
              className="px-4 py-2 rounded-xl border text-xs font-medium hover:opacity-85 cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxPhoto.url}
            alt={lightboxPhoto.caption || ''}
            className="max-w-full max-h-[82vh] rounded-2xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxPhoto.caption && (
            <div className="mt-3 px-4 py-1.5 rounded-full bg-white/15 text-white text-xs">
              {lightboxPhoto.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
