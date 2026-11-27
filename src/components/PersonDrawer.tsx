import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Edit3,
  Save,
  Trash2,
  UserPlus,
  Heart,
  Baby,
  Users,
  ArrowUp,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Calendar,
  BookOpen,
  Sparkles,
  Crosshair,
  Camera,
  Unlink,
  MessageCircle,
  GitBranch,
  StickyNote,
  ImagePlus,
  Images,
  Settings2,
  ArrowDown,
} from 'lucide-react';
import { FamilyTreeData, Gender, Person, PhotoItem, QuickAddRelation, SpouseStatus } from '../types/family';
import {
  generateId,
  getChildrenOf,
  getDisplayNameWithNickname,
  getFullName,
  getSiblingRankInfo,
  getSiblingsOf,
} from '../utils/familyOps';
import { calculateAge, formatThaiDate } from '../utils/dateUtils';
import { resizeGalleryImageFile } from '../utils/imageUtils';
import { uploadDataUrlToStorage } from '../lib/supabase';
import { PersonAvatar } from './PersonAvatar';
import { ImageCropModal } from './ImageCropModal';

interface PersonDrawerProps {
  data: FamilyTreeData;
  person: Person;
  generation?: number;
  existingBranches: string[];
  isLineageHighlighted: boolean;
  canEdit?: boolean;
  initialEditMode?: boolean;
  onClose: () => void;
  onSavePerson: (updated: Person) => void;
  onDeletePerson: (personId: string) => void;
  onSelectPerson: (personId: string) => void;
  onOpenCoupleDetail?: (personAId: string, personBId: string) => void;
  onReorderChildren?: (orderedChildIds: string[]) => void;
  onQuickAdd: (anchorId: string, relation: QuickAddRelation) => void;
  onUnlinkParent: (parentId: string, childId: string) => void;
  onUnlinkSpouse: (personAId: string, personBId: string) => void;
  onUpdateSpouseStatus: (
    personAId: string,
    personBId: string,
    status: SpouseStatus,
    marriageDate?: string
  ) => void;
  onToggleLineageHighlight: (personId: string) => void;
  onFocusSubtree: (personId: string) => void;
}

const SPOUSE_STATUS_LABELS: Record<SpouseStatus, string> = {
  married: 'สมรส',
  partner: 'คู่ชีวิต',
  divorced: 'หย่าร้าง',
  widowed: 'คู่สมรสผู้ล่วงลับ',
};

export const PersonDrawer: React.FC<PersonDrawerProps> = ({
  data,
  person,
  generation,
  existingBranches,
  isLineageHighlighted,
  canEdit = true,
  initialEditMode = false,
  onClose,
  onSavePerson,
  onDeletePerson,
  onSelectPerson,
  onOpenCoupleDetail,
  onReorderChildren,
  onQuickAdd,
  onUnlinkParent,
  onUnlinkSpouse,
  onUpdateSpouseStatus,
  onToggleLineageHighlight,
  onFocusSubtree,
}) => {
  const [isEditing, setIsEditing] = useState(Boolean(initialEditMode && canEdit));
  const [draft, setDraft] = useState<Person>(person);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [quickNoteMode, setQuickNoteMode] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState(person.notes || '');
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);
  const [pendingCrop, setPendingCrop] = useState<{ file: File; mode: 'edit' | 'quick' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickAvatarInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Reset edit mode when switching to a different person or toggling edit permission
  useEffect(() => {
    setDraft(person);
    setQuickNoteText(person.notes || '');
    setQuickNoteMode(false);
    setIsEditing(Boolean(initialEditMode && canEdit));
    setConfirmDelete(false);
    setUploadError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id, initialEditMode, canEdit]);

  // Keep draft synchronized when person's data updates (e.g. photo upload, remote merge, or save)
  useEffect(() => {
    setDraft(person);
    setQuickNoteText(person.notes || '');
    setQuickNoteMode(false);
    setConfirmDelete(false);
    setUploadError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.updatedAt]);

  const parents = person.parentIds.map((id) => data.members[id]).filter(Boolean);
  const children = getChildrenOf(data.members, person.id);
  const siblings = getSiblingsOf(data.members, person.id);
  const siblingRank = getSiblingRankInfo(data.members, person.id);
  const age = calculateAge(person.birthDate, person.deathDate, person.isDeceased);
  const gallery = person.gallery ?? [];

  const handlePhotoUploadEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setPendingCrop({ file, mode: 'edit' });
    e.target.value = '';
  };

  // Instant 1-click avatar change right from View mode (with crop & zoom first!)
  const handleQuickAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;
    setUploadError('');
    setPendingCrop({ file, mode: 'quick' });
    e.target.value = '';
  };

  const handleConfirmCrop = async (croppedDataUrl: string) => {
    const mode = pendingCrop?.mode;
    setPendingCrop(null);
    try {
      const storedUrl = await uploadDataUrlToStorage(croppedDataUrl, 'avatars');
      if (mode === 'quick') {
        onSavePerson({ ...person, photo: storedUrl });
      } else {
        setDraft((prev) => ({ ...prev, photo: storedUrl }));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    }
  };

  // Add one or more photos to person's memory album
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !canEdit) return;
    setUploadError('');
    try {
      const newItems: PhotoItem[] = [];
      for (const file of files.slice(0, 6)) {
        const dataUrl = await resizeGalleryImageFile(file, 760, 0.8);
        const storedUrl = await uploadDataUrlToStorage(dataUrl, 'gallery');
        newItems.push({
          id: generateId('img'),
          url: storedUrl,
          caption: file.name.replace(/\.[^.]+$/, ''),
        });
      }
      onSavePerson({
        ...person,
        gallery: [...gallery, ...newItems],
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'อัปโหลดรูปอัลบั้มไม่สำเร็จ');
    }
    e.target.value = '';
  };

  const handleDeleteGalleryPhoto = (photoId: string) => {
    if (!canEdit) return;
    onSavePerson({
      ...person,
      gallery: gallery.filter((g) => g.id !== photoId),
    });
    if (lightboxPhoto?.id === photoId) setLightboxPhoto(null);
  };

  const handleSaveQuickNote = () => {
    if (!canEdit) return;
    onSavePerson({
      ...person,
      notes: quickNoteText.trim() || undefined,
    });
    setQuickNoteMode(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.firstName.trim() || !canEdit) return;
    onSavePerson({
      ...draft,
      title: draft.title?.trim() || undefined,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      maidenName: draft.maidenName?.trim() || undefined,
      nickname: draft.nickname?.trim() || undefined,
      birthDate: draft.birthDate?.trim() || undefined,
      birthPlace: draft.birthPlace?.trim() || undefined,
      deathDate: draft.isDeceased ? draft.deathDate?.trim() || undefined : undefined,
      occupation: draft.occupation?.trim() || undefined,
      educationStatus:
        draft.educationStatus && draft.educationStatus !== 'none'
          ? draft.educationStatus
          : undefined,
      education: draft.education?.trim() || undefined,
      graduatedFrom: draft.graduatedFrom?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      lineId: draft.lineId?.trim() || undefined,
      address: draft.address?.trim() || undefined,
      branch: draft.branch?.trim() || undefined,
      bio: draft.bio?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
    });
    setIsEditing(false);
  };

  return (
    <aside className="w-full sm:w-[420px] shrink-0 theme-surface border-l shadow-xl flex flex-col h-full z-30 animate-slide-in-right">
      {/* Drawer Header */}
      <div className="px-5 py-4 theme-subtle border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {generation != null && (
            <span
              style={{ backgroundColor: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0"
            >
              รุ่นที่ {generation}
            </span>
          )}
          <span className="text-xs font-medium theme-muted-text truncate">
            {isEditing ? 'กำลังแก้ไขข้อมูลสมาชิก' : 'ข้อมูลสมาชิกในตระกูล'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isEditing && canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl theme-primary-btn text-xs font-medium transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              แก้ไข
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg theme-muted-text hover:bg-black/5 transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isEditing ? (
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <PersonAvatar person={draft} size="xl" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ backgroundColor: 'var(--theme-primary)' }}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full text-white flex items-center justify-center shadow hover:opacity-90 transition-opacity cursor-pointer"
                title="อัปโหลดรูปภาพ"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUploadEdit}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium">รูปโปรไฟล์สมาชิก</div>
              <p className="text-[11px] theme-muted-text mt-0.5">
                รองรับ JPG/PNG ระบบจะย่อขนาดอัตโนมัติเพื่อประหยัดพื้นที่
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium theme-primary-text hover:underline cursor-pointer"
                >
                  เลือกรูปภาพ
                </button>
                {draft.photo && (
                  <button
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, photo: undefined }))}
                    className="text-xs text-[#C24B38] hover:underline cursor-pointer"
                  >
                    ลบรูปออก
                  </button>
                )}
              </div>
              {uploadError && <p className="text-[11px] text-[#C24B38] mt-1">{uploadError}</p>}
            </div>
          </div>

          {/* Section 1: Basic Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide theme-muted-text">
              ข้อมูลพื้นฐาน
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">คำนำหน้า</label>
                <input
                  type="text"
                  value={draft.title || ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="คุณ, ดร., นพ."
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium theme-muted-text mb-1">
                  ชื่อจริง <span className="text-[#C04A34]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={draft.firstName}
                  onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">นามสกุล</label>
                <input
                  type="text"
                  value={draft.lastName}
                  onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">
                  นามสกุลเดิม (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={draft.maidenName || ''}
                  onChange={(e) => setDraft({ ...draft, maidenName: e.target.value })}
                  placeholder="ก่อนสมรส"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">ชื่อเล่น</label>
                <input
                  type="text"
                  value={draft.nickname || ''}
                  onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
                  placeholder="เช่น อากง, พี่ต้น"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">เพศ</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['male', 'female', 'other'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setDraft({ ...draft, gender: g })}
                      style={
                        draft.gender === g
                          ? { backgroundColor: 'var(--theme-primary)', color: '#fff', borderColor: 'transparent' }
                          : { borderColor: 'var(--theme-border)' }
                      }
                      className="py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer"
                    >
                      {g === 'male' ? 'ชาย' : g === 'female' ? 'หญิง' : 'อื่นๆ'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium theme-muted-text mb-1">
                  สายตระกูล / บ้าน
                </label>
                <input
                  type="text"
                  list="drawer-branches"
                  value={draft.branch || ''}
                  onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
                  placeholder="เช่น สายบ้านใหญ่, สายเชียงใหม่"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
                <datalist id="drawer-branches">
                  {existingBranches.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">ลำดับบุตร</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.birthOrder ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      birthOrder: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    })
                  }
                  placeholder="คนที่..."
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dates & Status */}
          <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            <h4 className="text-xs font-semibold uppercase tracking-wide theme-muted-text">
              วันเกิดและสถานะ
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">วันเกิด</label>
                <input
                  type="date"
                  value={draft.birthDate || ''}
                  onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">สถานที่เกิด</label>
                <input
                  type="text"
                  value={draft.birthPlace || ''}
                  onChange={(e) => setDraft({ ...draft, birthPlace: e.target.value })}
                  placeholder="จังหวัด/เมือง"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 theme-subtle px-3 py-2.5 rounded-xl border">
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.isDeceased}
                  onChange={(e) => setDraft({ ...draft, isDeceased: e.target.checked })}
                  className="rounded"
                />
                เสียชีวิตแล้ว (ผู้ล่วงลับ)
              </label>
              {draft.isDeceased && (
                <input
                  type="date"
                  value={draft.deathDate || ''}
                  onChange={(e) => setDraft({ ...draft, deathDate: e.target.value })}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="px-2 py-1 text-xs rounded-lg border focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Section 3: Contact, Bio & Notes */}
          <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            <h4 className="text-xs font-semibold uppercase tracking-wide theme-muted-text">
              อาชีพ การติดต่อ และหมายเหตุ
            </h4>
            <div>
              <label className="block text-[11px] font-medium theme-muted-text mb-1">อาชีพ</label>
              <input
                type="text"
                value={draft.occupation || ''}
                onChange={(e) => setDraft({ ...draft, occupation: e.target.value })}
                placeholder="เช่น ครู, ธุรกิจส่วนตัว, ทำงานอยู่กรุงเทพ..."
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
              />
            </div>

            {/* Education Status + Current Education + Graduated From */}
            <div
              style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-subtle)' }}
              className="p-3 rounded-xl border space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold theme-muted-text">
                  <GraduationCap className="w-3.5 h-3.5" />
                  สถานะการศึกษา
                </label>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'studying', label: 'กำลังศึกษาอยู่' },
                    { id: 'graduated', label: 'เรียนจบแล้ว' },
                    { id: 'none', label: 'ไม่ระบุ' },
                  ] as const
                ).map(({ id, label }) => {
                  const active = (draft.educationStatus || 'none') === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          educationStatus: id === 'none' ? undefined : id,
                        })
                      }
                      style={
                        active
                          ? {
                              backgroundColor: 'var(--theme-primary)',
                              color: '#fff',
                              borderColor: 'var(--theme-primary)',
                            }
                          : {
                              backgroundColor: 'var(--theme-bg-surface)',
                              borderColor: 'var(--theme-border)',
                            }
                      }
                      className="py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer text-center"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">
                  {draft.educationStatus === 'studying'
                    ? 'กำลังเรียนอยู่ระดับ / สถาบัน'
                    : draft.educationStatus === 'graduated'
                      ? 'วุฒิการศึกษาหลัก / สาขา'
                      : 'การศึกษา'}
                </label>
                <input
                  type="text"
                  value={draft.education || ''}
                  onChange={(e) => setDraft({ ...draft, education: e.target.value })}
                  placeholder={
                    draft.educationStatus === 'studying'
                      ? 'เช่น ปี 2 มฟน., ม.4 อิสลาฮียะห์, ป.5...'
                      : 'เช่น ปริญญาตรี อิสลามศึกษา มฟน.'
                  }
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">
                  เรียนจบจากที่ไหนบ้าง (ใส่ได้หลายสถาบัน)
                </label>
                <textarea
                  rows={2}
                  value={draft.graduatedFrom || ''}
                  onChange={(e) => setDraft({ ...draft, graduatedFrom: e.target.value })}
                  placeholder="เช่น รร.บ้านบาจุ, รร.อิสลาฮียะห์ ยะลา, มหาวิทยาลัยฟาฏอนี..."
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border focus:outline-none resize-y"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={draft.phone || ''}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="08x-xxx-xxxx"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium theme-muted-text mb-1">Line ID</label>
                <input
                  type="text"
                  value={draft.lineId || ''}
                  onChange={(e) => setDraft({ ...draft, lineId: e.target.value })}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium theme-muted-text mb-1">ที่อยู่ / จังหวัด</label>
              <input
                type="text"
                value={draft.address || ''}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                className="w-full px-2.5 py-1.5 text-sm rounded-xl border focus:outline-none"
              />
            </div>

            {/* Dedicated Notes textarea */}
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold theme-accent-text mb-1">
                <StickyNote className="w-3.5 h-3.5" />
                หมายเหตุสำคัญ (Notes)
              </label>
              <textarea
                rows={3}
                value={draft.notes || ''}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="เช่น แพ้อาหาร, โรคประจำตัว, เบอร์ฉุกเฉิน, วันทำบุญครบรอบ, ของที่ชอบ..."
                style={{ borderColor: 'var(--theme-accent)', backgroundColor: 'var(--theme-bg-surface)' }}
                className="w-full px-2.5 py-2 text-sm rounded-xl border focus:outline-none resize-y"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium theme-muted-text mb-1">
                ประวัติย่อ / เรื่องเล่าประจำตัว
              </label>
              <textarea
                rows={3}
                value={draft.bio || ''}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                placeholder="บันทึกความทรงจำ งานอดิเรก หรือเรื่องราวของท่าน..."
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                className="w-full px-2.5 py-2 text-sm rounded-xl border focus:outline-none resize-y"
              />
            </div>
          </div>

          {/* Section 4: Manage Existing Relationships */}
          {(parents.length > 0 || person.spouses.length > 0) && (
            <div className="space-y-2.5 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <h4 className="text-xs font-semibold uppercase tracking-wide theme-muted-text">
                จัดการสายสัมพันธ์ปัจจุบัน
              </h4>
              {parents.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl theme-subtle border"
                >
                  <div className="text-xs truncate">
                    <span className="theme-muted-text mr-1.5">พ่อ/แม่:</span>
                    <strong>{getDisplayNameWithNickname(p)}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUnlinkParent(p.id, person.id)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#C24B38] hover:underline shrink-0 cursor-pointer"
                  >
                    <Unlink className="w-3 h-3" />
                    ยกเลิก
                  </button>
                </div>
              ))}
              {person.spouses.map((sp) => {
                const spouse = data.members[sp.spouseId];
                if (!spouse) return null;
                return (
                  <div key={sp.spouseId} className="p-2.5 rounded-xl theme-subtle border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs truncate">
                        <span className="theme-accent-text mr-1.5">คู่สมรส:</span>
                        <strong>{getDisplayNameWithNickname(spouse)}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUnlinkSpouse(person.id, sp.spouseId)}
                        className="inline-flex items-center gap-1 text-[11px] text-[#C24B38] hover:underline shrink-0 cursor-pointer"
                      >
                        <Unlink className="w-3 h-3" />
                        ยกเลิก
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={sp.status}
                        onChange={(e) =>
                          onUpdateSpouseStatus(
                            person.id,
                            sp.spouseId,
                            e.target.value as SpouseStatus,
                            sp.marriageDate
                          )
                        }
                        style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                        className="flex-1 px-2 py-1 text-xs rounded-lg border"
                      >
                        <option value="married">สมรส</option>
                        <option value="partner">คู่ชีวิต</option>
                        <option value="divorced">หย่าร้าง</option>
                        <option value="widowed">คู่สมรสผู้ล่วงลับ</option>
                      </select>
                      <input
                        type="date"
                        value={sp.marriageDate || ''}
                        onChange={(e) =>
                          onUpdateSpouseStatus(person.id, sp.spouseId, sp.status, e.target.value)
                        }
                        title="วันแต่งงาน"
                        style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                        className="px-2 py-1 text-xs rounded-lg border"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Danger zone */}
          <div className="pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C24B38] hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ลบสมาชิกคนนี้ออกจากผังตระกูล
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-[#FCEEEB] border border-[#ECC5BC] space-y-2">
                <p className="text-xs text-[#8E3224]">
                  ยืนยันการลบ <strong>{getFullName(person)}</strong>? สายสัมพันธ์ที่เชื่อมต่อกับคนนี้จะถูกตัดออก (สามารถกด Undo ย้อนกลับได้)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDeletePerson(person.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#B54735] text-white text-xs font-medium hover:bg-[#963626] cursor-pointer"
                  >
                    ยืนยันลบ
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#53615C] border border-[#DDD6CA] text-xs cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Save Footer */}
          <div
            style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
            className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 border-t flex justify-end gap-2"
          >
            <button
              type="button"
              onClick={() => {
                setDraft(person);
                setIsEditing(false);
              }}
              className="px-4 py-2 text-xs font-medium rounded-xl theme-muted-text hover:bg-black/5 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium rounded-xl theme-primary-btn shadow-sm cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              บันทึกข้อมูล
            </button>
          </div>
        </form>
      ) : (
        /* PROFILE VIEW MODE */
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identity Card with 1-Click Photo Upload */}
          <div className="flex items-start gap-4">
            <div className="relative group">
              <PersonAvatar person={person} size="xl" />
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => quickAvatarInputRef.current?.click()}
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer"
                    title="คลิกเพื่อเพิ่ม/เปลี่ยนรูปโปรไฟล์"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={quickAvatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQuickAvatarUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {person.nickname && (
                  <span
                    style={{ backgroundColor: 'var(--theme-accent-soft)', color: 'var(--theme-accent)' }}
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  >
                    {person.nickname}
                  </span>
                )}
                {siblingRank && (
                  <span
                    style={{ backgroundColor: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  >
                    {siblingRank.label}
                  </span>
                )}
                {person.branch && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full theme-subtle theme-muted-text">
                    <GitBranch className="w-2.5 h-2.5" />
                    {person.branch}
                  </span>
                )}
                {person.isDeceased && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full theme-subtle theme-muted-text">
                    ผู้ล่วงลับ
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold font-serif-thai leading-snug">
                {getFullName(person)}
              </h3>

              {person.maidenName && (
                <p className="text-xs theme-muted-text mt-0.5">
                  นามสกุลเดิม: {person.maidenName}
                </p>
              )}

              <p className="text-xs theme-muted-text mt-1">
                {person.gender === 'male' ? 'ชาย' : person.gender === 'female' ? 'หญิง' : 'ไม่ระบุเพศ'}
                {age != null && (
                  <span> · {person.isDeceased ? `สิริอายุ ${age} ปี` : `อายุ ${age} ปี`}</span>
                )}
              </p>
            </div>
          </div>

          {uploadError && (
            <div className="px-3 py-2 rounded-xl bg-[#FCEEEB] text-[#9E3B28] text-xs">{uploadError}</div>
          )}

          {/* Dedicated Notes Callout with Quick Inline Edit */}
          {(person.notes || canEdit) && (
            <div
              style={{
                backgroundColor: 'var(--theme-accent-soft)',
                borderColor: 'var(--theme-accent)',
              }}
              className="p-3.5 rounded-2xl border-l-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold theme-accent-text">
                  <StickyNote className="w-3.5 h-3.5" />
                  หมายเหตุประจำตัว (Notes)
                </div>
                {canEdit && !quickNoteMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickNoteText(person.notes || '');
                      setQuickNoteMode(true);
                    }}
                    className="text-[11px] font-medium theme-accent-text hover:underline cursor-pointer"
                  >
                    {person.notes ? 'แก้ไขหมายเหตุ' : '+ เพิ่มหมายเหตุ'}
                  </button>
                )}
              </div>

              {quickNoteMode && canEdit ? (
                <div className="space-y-2">
                  <textarea
                    rows={3}
                    autoFocus
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    placeholder="บันทึกข้อควรจำ เช่น แพ้อาหาร, โรคประจำตัว, ของที่ชอบ..."
                    style={{ backgroundColor: 'var(--theme-bg-surface)', borderColor: 'var(--theme-border)' }}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border focus:outline-none resize-y"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQuickNoteMode(false)}
                      className="px-2.5 py-1 text-[11px] rounded-lg hover:bg-black/5 cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuickNote}
                      className="px-3 py-1 text-[11px] font-medium rounded-lg theme-accent-btn cursor-pointer"
                    >
                      บันทึกหมายเหตุ
                    </button>
                  </div>
                </div>
              ) : person.notes ? (
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{person.notes}</p>
              ) : (
                <p className="text-[11.5px] theme-muted-text">
                  ยังไม่มีหมายเหตุ — กด "+ เพิ่มหมายเหตุ" เพื่อจดบันทึกข้อควรจำของคนนี้
                </p>
              )}
            </div>
          )}

          {/* Tree Focus & Lineage Action Pills */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToggleLineageHighlight(person.id)}
              style={
                isLineageHighlighted
                  ? { backgroundColor: 'var(--theme-accent)', color: '#fff', borderColor: 'transparent' }
                  : undefined
              }
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                isLineageHighlighted ? '' : 'theme-subtle hover:opacity-85'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isLineageHighlighted ? 'กำลังไฮไลต์สายตรง' : 'ไฮไลต์สายตรง'}
            </button>
            <button
              onClick={() => onFocusSubtree(person.id)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium theme-subtle border hover:opacity-85 transition-opacity cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              ดูผังเริ่มจากคนนี้
            </button>
          </div>

          {/* Quick Add Relatives Panel (hidden when editing is locked) */}
          {canEdit && (
            <div className="p-3.5 rounded-2xl theme-subtle border space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <UserPlus className="w-3.5 h-3.5 theme-primary-text" />
                เพิ่มญาติเชื่อมโยงกับ {person.nickname || person.firstName}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onQuickAdd(person.id, 'spouse')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl theme-surface border hover:opacity-85 text-xs font-medium transition-all cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 theme-accent-text" />
                  เพิ่มคู่สมรส
                </button>
                <button
                  onClick={() => onQuickAdd(person.id, 'child')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl theme-surface border hover:opacity-85 text-xs font-medium transition-all cursor-pointer"
                >
                  <Baby className="w-3.5 h-3.5 theme-primary-text" />
                  เพิ่มบุตร
                </button>
                <button
                  onClick={() => onQuickAdd(person.id, 'parent')}
                  disabled={person.parentIds.length >= 2}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl theme-surface border text-xs font-medium transition-all ${
                    person.parentIds.length >= 2
                      ? 'opacity-45 cursor-not-allowed'
                      : 'hover:opacity-85 cursor-pointer'
                  }`}
                >
                  <ArrowUp className="w-3.5 h-3.5 theme-primary-text" />
                  เพิ่มพ่อ / แม่
                </button>
                <button
                  onClick={() => onQuickAdd(person.id, 'sibling')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl theme-surface border hover:opacity-85 text-xs font-medium transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 theme-muted-text" />
                  เพิ่มพี่ / น้อง
                </button>
              </div>
            </div>
          )}

          {/* Photo Memory Gallery Section */}
          {(gallery.length > 0 || canEdit) && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide theme-muted-text flex items-center gap-1.5">
                  <Images className="w-3.5 h-3.5" />
                  อัลบั้มรูปภาพ ({gallery.length})
                </h4>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="inline-flex items-center gap-1 text-xs font-medium theme-primary-text hover:underline cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      เพิ่มรูปภาพ
                    </button>
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryUpload}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              {gallery.length === 0 ? (
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  style={{ borderColor: 'var(--theme-border)' }}
                  className="w-full py-4 px-3 rounded-xl border border-dashed text-center text-xs theme-muted-text hover:bg-black/5 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <ImagePlus className="w-4 h-4 theme-primary-text" />
                  คลิกเพื่อเพิ่มรูปภาพความทรงจำ (เลือกได้หลายรูป)
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((item) => (
                    <div
                      key={item.id}
                      className="relative group aspect-square rounded-xl overflow-hidden border"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      <img
                        src={item.url}
                        alt={item.caption || 'ภาพความทรงจำ'}
                        onClick={() => setLightboxPhoto(item)}
                        className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                      />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGalleryPhoto(item.id);
                          }}
                          title="ลบรูปภาพนี้"
                          className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 w-6 h-6 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-[#B54735] transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      style={{ borderColor: 'var(--theme-border)' }}
                      className="aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 theme-muted-text hover:bg-black/5 text-[11px] cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4 theme-primary-text" />
                      เพิ่มรูป
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Details List */}
          <div className="space-y-2.5 text-sm">
            {person.birthDate && (
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 theme-muted-text mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] theme-muted-text">วันเกิด</div>
                  <div className="text-xs font-medium">
                    {formatThaiDate(person.birthDate, 'full')}
                    {person.birthPlace ? ` · จ.${person.birthPlace}` : ''}
                  </div>
                </div>
              </div>
            )}

            {person.isDeceased && person.deathDate && (
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 theme-muted-text mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] theme-muted-text">วันที่ถึงแก่กรรม</div>
                  <div className="text-xs font-medium">{formatThaiDate(person.deathDate, 'full')}</div>
                </div>
              </div>
            )}

            {person.occupation && (
              <div className="flex items-start gap-2.5">
                <Briefcase className="w-4 h-4 theme-muted-text mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] theme-muted-text">อาชีพ</div>
                  <div className="text-xs">{person.occupation}</div>
                </div>
              </div>
            )}

            {(person.education || person.educationStatus || person.graduatedFrom) && (
              <div className="flex items-start gap-2.5">
                <GraduationCap className="w-4 h-4 theme-muted-text mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] theme-muted-text">การศึกษา</span>
                    {person.educationStatus === 'studying' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        กำลังศึกษาอยู่
                      </span>
                    )}
                    {person.educationStatus === 'graduated' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        เรียนจบแล้ว
                      </span>
                    )}
                  </div>
                  {person.education && <div className="text-xs font-medium">{person.education}</div>}
                  {person.graduatedFrom && (
                    <div className="text-[11.5px] theme-muted-text whitespace-pre-wrap">
                      จบจาก: {person.graduatedFrom}
                    </div>
                  )}
                </div>
              </div>
            )}

            {person.phone && (
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 theme-muted-text mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] theme-muted-text">เบอร์โทรศัพท์</div>
                  <a href={`tel:${person.phone}`} className="text-xs theme-primary-text font-medium hover:underline">
                    {person.phone}
                  </a>
                </div>
              </div>
            )}

            {person.lineId && (
              <div className="flex items-start gap-2.5">
                <MessageCircle className="w-4 h-4 theme-muted-text mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] theme-muted-text">Line ID</div>
                  <div className="text-xs font-mono">{person.lineId}</div>
                </div>
              </div>
            )}

            {person.address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 theme-muted-text mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] theme-muted-text">ที่อยู่</div>
                  <div className="text-xs">{person.address}</div>
                </div>
              </div>
            )}

            {person.bio && (
              <div className="flex items-start gap-2.5 pt-2">
                <BookOpen className="w-4 h-4 theme-muted-text mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-[11px] theme-muted-text mb-1">ประวัติ / เรื่องเล่า</div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap theme-subtle p-3 rounded-xl border">
                    {person.bio}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Clickable Family Connections */}
          <div className="space-y-3.5 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
            <h4 className="text-xs font-semibold uppercase tracking-wide theme-muted-text">
              เครือญาติใกล้ชิด
            </h4>

            {parents.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium theme-muted-text">บิดา / มารดา</div>
                <div className="space-y-1.5">
                  {parents.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectPerson(p.id)}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-black/5 transition-colors text-left cursor-pointer"
                    >
                      <PersonAvatar person={p} size="xs" />
                      <span className="text-xs font-medium truncate">
                        {getDisplayNameWithNickname(p)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {person.spouses.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium theme-muted-text">คู่สมรส / ครอบครัว</div>
                <div className="space-y-2">
                  {person.spouses.map((sp) => {
                    const spouse = data.members[sp.spouseId];
                    if (!spouse) return null;
                    return (
                      <div
                        key={sp.spouseId}
                        className="p-2.5 rounded-xl theme-subtle border space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => onSelectPerson(spouse.id)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left hover:opacity-80 cursor-pointer"
                          >
                            <PersonAvatar person={spouse} size="xs" />
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">
                                {getDisplayNameWithNickname(spouse)}
                              </div>
                              <div className="text-[10.5px] theme-muted-text truncate">
                                {[
                                  sp.familyName,
                                  sp.marriageDate ? `สมรส ${formatThaiDate(sp.marriageDate)}` : '',
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || SPOUSE_STATUS_LABELS[sp.status]}
                              </div>
                            </div>
                          </button>

                          {onOpenCoupleDetail && (
                            <button
                              type="button"
                              onClick={() => onOpenCoupleDetail(person.id, spouse.id)}
                              style={{
                                backgroundColor: 'var(--theme-bg-surface)',
                                borderColor: 'var(--theme-border)',
                                color: 'var(--theme-primary)',
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10.5px] font-semibold shrink-0 hover:opacity-85 cursor-pointer"
                              title="ตั้งค่ารายละเอียดคู่ครอบครัวนี้"
                            >
                              <Settings2 className="w-3 h-3" />
                              {canEdit ? 'ตั้งค่าคู่' : 'รายละเอียด'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {siblings.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium theme-muted-text">
                  พี่น้องร่วมพ่อแม่ (รวม {siblings.length + 1} คน)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {siblings.map((s) => {
                    const sRank = getSiblingRankInfo(data.members, s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => onSelectPerson(s.id)}
                        className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full theme-subtle border hover:opacity-85 text-xs transition-opacity cursor-pointer"
                      >
                        <PersonAvatar person={s} size="xs" />
                        {sRank && (
                          <span
                            style={{ backgroundColor: 'var(--theme-primary)', color: '#fff' }}
                            className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full"
                          >
                            คนที่ {sRank.order}
                          </span>
                        )}
                        <span>{s.nickname || s.firstName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {children.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-medium theme-muted-text">
                    บุตร เรียงตามลำดับพี่น้อง ({children.length} คน)
                  </div>
                  {canEdit && children.length > 1 && onReorderChildren && (
                    <span className="text-[10px] theme-muted-text">กด ▲/▼ สลับลำดับ</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {children.map((c, idx) => {
                    const cRank = getSiblingRankInfo(data.members, c.id);
                    const move = (dir: -1 | 1) => {
                      if (!onReorderChildren) return;
                      const target = idx + dir;
                      if (target < 0 || target >= children.length) return;
                      const nextIds = children.map((ch) => ch.id);
                      const [moved] = nextIds.splice(idx, 1);
                      nextIds.splice(target, 0, moved);
                      onReorderChildren(nextIds);
                    };
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl theme-subtle border"
                      >
                        <button
                          onClick={() => onSelectPerson(c.id)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 cursor-pointer"
                        >
                          <span
                            style={{ backgroundColor: 'var(--theme-primary)', color: '#fff' }}
                            className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0"
                          >
                            {c.birthOrder ?? idx + 1}
                          </span>
                          <PersonAvatar person={c} size="xs" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">
                              {getDisplayNameWithNickname(c)}
                            </div>
                            <div className="text-[10.5px] theme-muted-text truncate">
                              {cRank?.label || `คนที่ ${idx + 1}`}
                              {c.occupation ? ` · ${c.occupation}` : ''}
                            </div>
                          </div>
                        </button>
                        {canEdit && children.length > 1 && onReorderChildren && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => move(-1)}
                              title="เลื่อนขึ้นเป็นพี่"
                              className="p-1 rounded-lg hover:bg-black/10 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === children.length - 1}
                              onClick={() => move(1)}
                              title="เลื่อนลงเป็นน้อง"
                              className="p-1 rounded-lg hover:bg-black/10 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
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

      {/* Touch & Zoom Avatar Crop Modal */}
      {pendingCrop && (
        <ImageCropModal
          file={pendingCrop.file}
          onCancel={() => setPendingCrop(null)}
          onConfirm={handleConfirmCrop}
        />
      )}
    </aside>
  );
};
