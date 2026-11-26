import React, { useMemo, useRef, useState } from 'react';
import { X, UserPlus, Link2, Search, Camera, StickyNote } from 'lucide-react';
import { FamilyTreeData, Gender, Person, QuickAddRelation, SpouseStatus } from '../types/family';
import { getDisplayNameWithNickname } from '../utils/familyOps';
import { resizeImageFile } from '../utils/imageUtils';
import { uploadDataUrlToStorage } from '../lib/supabase';
import { PersonAvatar } from './PersonAvatar';

interface QuickAddModalProps {
  data: FamilyTreeData;
  anchorPerson: Person | null;
  relation: QuickAddRelation | 'standalone';
  existingBranches: string[];
  onClose: () => void;
  onCreateNew: (fields: {
    firstName: string;
    lastName: string;
    nickname?: string;
    gender: Gender;
    photo?: string;
    birthDate?: string;
    isDeceased?: boolean;
    deathDate?: string;
    occupation?: string;
    branch?: string;
    notes?: string;
    spouseStatus?: SpouseStatus;
    otherParentId?: string;
  }) => void;
  onLinkExisting?: (existingPersonId: string, spouseStatus?: SpouseStatus) => void;
}

const RELATION_META: Record<
  QuickAddRelation | 'standalone',
  { title: string; subtitle: (name: string) => string }
> = {
  child: {
    title: 'เพิ่มบุตร',
    subtitle: (name) => `เพิ่มลูกของ ${name}`,
  },
  parent: {
    title: 'เพิ่มพ่อ / แม่',
    subtitle: (name) => `เพิ่มบิดาหรือมารดาของ ${name}`,
  },
  spouse: {
    title: 'เพิ่มคู่สมรส',
    subtitle: (name) => `เพิ่มคู่สมรสของ ${name}`,
  },
  sibling: {
    title: 'เพิ่มพี่ / น้อง',
    subtitle: (name) => `เพิ่มพี่น้องร่วมบิดามารดากับ ${name}`,
  },
  standalone: {
    title: 'เพิ่มสมาชิกใหม่',
    subtitle: () => 'สร้างประวัติสมาชิกใหม่ในผังตระกูล (สามารถเชื่อมโยงญาติภายหลังได้)',
  },
};

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  data,
  anchorPerson,
  relation,
  existingBranches,
  onClose,
  onCreateNew,
  onLinkExisting,
}) => {
  const canLinkExisting =
    Boolean(anchorPerson && onLinkExisting) &&
    (relation === 'child' || relation === 'parent' || relation === 'spouse');

  const [tab, setTab] = useState<'new' | 'existing'>('new');

  const defaultGender: Gender = useMemo(() => {
    if (!anchorPerson) return 'male';
    if (relation === 'spouse') {
      return anchorPerson.gender === 'male' ? 'female' : 'male';
    }
    if (relation === 'parent' && anchorPerson.parentIds.length === 1) {
      const existingP = data.members[anchorPerson.parentIds[0]];
      if (existingP) return existingP.gender === 'male' ? 'female' : 'male';
    }
    return 'male';
  }, [anchorPerson, relation, data.members]);

  const defaultLastName = anchorPerson?.lastName ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState(defaultLastName);
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender>(defaultGender);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [birthDate, setBirthDate] = useState('');
  const [isDeceased, setIsDeceased] = useState(false);
  const [deathDate, setDeathDate] = useState('');
  const [occupation, setOccupation] = useState('');
  const [branch, setBranch] = useState(anchorPerson?.branch || '');
  const [notes, setNotes] = useState('');
  const [spouseStatus, setSpouseStatus] = useState<SpouseStatus>('married');
  const [otherParentId, setOtherParentId] = useState<string>(
    anchorPerson && anchorPerson.spouses.length > 0 ? anchorPerson.spouses[0].spouseId : ''
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const linkCandidates = useMemo(() => {
    if (!anchorPerson) return [];
    const q = searchTerm.trim().toLowerCase();
    return Object.values(data.members)
      .filter((m) => m.id !== anchorPerson.id)
      .filter((m) => {
        if (!q) return true;
        return (
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          (m.nickname || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.firstName.localeCompare(b.firstName, 'th'));
  }, [data.members, anchorPerson, searchTerm]);

  const meta = RELATION_META[relation];

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 256, 0.84);
      const storedUrl = await uploadDataUrlToStorage(dataUrl, 'avatars');
      setPhoto(storedUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปภาพได้');
    }
    e.target.value = '';
  };

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setErrorMsg('กรุณากรอกชื่อจริง');
      return;
    }
    onCreateNew({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      nickname: nickname.trim() || undefined,
      gender,
      photo,
      birthDate: birthDate.trim() || undefined,
      isDeceased,
      deathDate: isDeceased ? deathDate.trim() || undefined : undefined,
      occupation: occupation.trim() || undefined,
      branch: branch.trim() || undefined,
      notes: notes.trim() || undefined,
      spouseStatus,
      otherParentId: otherParentId || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg theme-surface rounded-2xl shadow-2xl border overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 theme-subtle border-b flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold font-serif-thai">{meta.title}</h2>
            <p className="text-xs theme-muted-text mt-0.5">
              {meta.subtitle(anchorPerson ? getDisplayNameWithNickname(anchorPerson) : '')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg theme-muted-text hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode switch if linking existing is supported */}
        {canLinkExisting && (
          <div className="px-6 pt-3 pb-1 flex gap-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
            <button
              type="button"
              onClick={() => setTab('new')}
              style={tab === 'new' ? { borderColor: 'var(--theme-primary)' } : undefined}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                tab === 'new' ? '' : 'border-transparent theme-muted-text'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              สร้างสมาชิกใหม่
            </button>
            <button
              type="button"
              onClick={() => setTab('existing')}
              style={tab === 'existing' ? { borderColor: 'var(--theme-primary)' } : undefined}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                tab === 'existing' ? '' : 'border-transparent theme-muted-text'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              เชื่อมโยงคนที่มีอยู่แล้ว
            </button>
          </div>
        )}

        {tab === 'new' ? (
          <form onSubmit={handleSubmitNew} className="p-6 space-y-4 max-h-[76vh] overflow-y-auto">
            {errorMsg && (
              <div className="px-3 py-2 rounded-lg bg-[#FCEEEB] border border-[#ECC5BC] text-[#9E3B28] text-xs">
                {errorMsg}
              </div>
            )}

            {/* Quick Photo Upload Row */}
            <div className="flex items-center gap-4 p-3 rounded-xl theme-subtle border">
              <div className="relative">
                <PersonAvatar
                  person={{
                    firstName: firstName || '?',
                    nickname,
                    gender,
                    photo,
                    isDeceased,
                  }}
                  size="lg"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  style={{ backgroundColor: 'var(--theme-primary)' }}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full text-white flex items-center justify-center shadow cursor-pointer hover:opacity-90"
                  title="เพิ่มรูปภาพ"
                >
                  <Camera className="w-3 h-3" />
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">รูปโปรไฟล์ (ไม่บังคับ)</div>
                <p className="text-[11px] theme-muted-text">
                  สามารถเพิ่มรูปได้เลยตอนนี้ หรือมาเพิ่มทีหลังก็ได้
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="text-xs font-medium theme-primary-text hover:underline cursor-pointer"
                  >
                    {photo ? 'เปลี่ยนรูปภาพ' : 'เลือกรูปภาพ'}
                  </button>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => setPhoto(undefined)}
                      className="text-xs text-[#C24B38] hover:underline cursor-pointer"
                    >
                      ลบรูป
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">
                  ชื่อจริง <span className="text-[#C04A34]">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="เช่น สมศักดิ์"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">นามสกุล</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="เช่น กิตติวัฒนากุล"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">ชื่อเล่น</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="เช่น น้องมิน, ลุงตู่"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">เพศ</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['male', 'female', 'other'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      style={
                        gender === g
                          ? {
                              backgroundColor: g === 'female' ? 'var(--theme-accent)' : 'var(--theme-primary)',
                              color: '#fff',
                              borderColor: 'transparent',
                            }
                          : { borderColor: 'var(--theme-border)' }
                      }
                      className="py-2 text-xs font-medium rounded-xl border transition-all cursor-pointer"
                    >
                      {g === 'male' ? 'ชาย' : g === 'female' ? 'หญิง' : 'อื่นๆ'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {relation === 'child' && anchorPerson && anchorPerson.spouses.length > 0 && (
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">
                  พ่อ/แม่ อีกฝ่าย (คู่สมรส)
                </label>
                <select
                  value={otherParentId}
                  onChange={(e) => setOtherParentId(e.target.value)}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                >
                  <option value="">— ไม่ระบุพ่อ/แม่อีกฝ่าย —</option>
                  {anchorPerson.spouses.map((sp) => {
                    const spouse = data.members[sp.spouseId];
                    if (!spouse) return null;
                    return (
                      <option key={sp.spouseId} value={sp.spouseId}>
                        {getDisplayNameWithNickname(spouse)}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {relation === 'spouse' && (
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">สถานะความสัมพันธ์</label>
                <select
                  value={spouseStatus}
                  onChange={(e) => setSpouseStatus(e.target.value as SpouseStatus)}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                >
                  <option value="married">สมรส / คู่ชีวิต</option>
                  <option value="partner">อยู่กินฉันสามีภรรยา</option>
                  <option value="divorced">หย่าร้าง / แยกทาง</option>
                  <option value="widowed">คู่สมรสเสียชีวิต</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">วันเกิด</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">สายตระกูล / บ้าน</label>
                <input
                  type="text"
                  list="branch-suggestions"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="เช่น สายบ้านใหญ่"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                />
                <datalist id="branch-suggestions">
                  {existingBranches.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">อาชีพ</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="เช่น วิศวกร, ธุรกิจส่วนตัว"
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                />
              </div>
              <div className="pt-4">
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDeceased}
                    onChange={(e) => setIsDeceased(e.target.checked)}
                    className="rounded"
                  />
                  เสียชีวิตแล้ว (ผู้ล่วงลับ)
                </label>
              </div>
            </div>

            {isDeceased && (
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">วันที่เสียชีวิต</label>
                <input
                  type="date"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                />
              </div>
            )}

            {/* Dedicated Notes Field right inside Quick Add */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium theme-muted-text mb-1">
                <StickyNote className="w-3.5 h-3.5 theme-accent-text" />
                หมายเหตุเพิ่มเติม (Notes)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น แพ้อาหาร, โรคประจำตัว, เบอร์ติดต่อฉุกเฉิน, ของที่ชอบ หรือข้อควรจำ..."
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none resize-y"
              />
            </div>

            <div
              className="pt-2 flex justify-end gap-2 border-t"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-xl theme-muted-text hover:bg-black/5 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-medium rounded-xl theme-primary-btn shadow-sm transition-colors cursor-pointer"
              >
                บันทึกและเพิ่มลงผัง
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-3">
            {relation === 'spouse' && (
              <div>
                <label className="block text-xs font-medium theme-muted-text mb-1">สถานะความสัมพันธ์</label>
                <select
                  value={spouseStatus}
                  onChange={(e) => setSpouseStatus(e.target.value as SpouseStatus)}
                  style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                  className="w-full px-3 py-2 text-sm rounded-xl border focus:outline-none"
                >
                  <option value="married">สมรส / คู่ชีวิต</option>
                  <option value="partner">อยู่กินฉันสามีภรรยา</option>
                  <option value="divorced">หย่าร้าง / แยกทาง</option>
                  <option value="widowed">คู่สมรสเสียชีวิต</option>
                </select>
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 theme-muted-text absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อ ชื่อเล่น หรือนามสกุล..."
                style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-bg-surface)' }}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border focus:outline-none"
              />
            </div>

            <div
              style={{ borderColor: 'var(--theme-border)' }}
              className="max-h-64 overflow-y-auto divide-y border rounded-xl"
            >
              {linkCandidates.length === 0 ? (
                <div className="py-8 text-center text-xs theme-muted-text">ไม่พบสมาชิกที่ตรงกับการค้นหา</div>
              ) : (
                linkCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => onLinkExisting?.(candidate.id, spouseStatus)}
                    style={{ borderColor: 'var(--theme-border)' }}
                    className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-black/5 text-left transition-colors cursor-pointer"
                  >
                    <PersonAvatar person={candidate} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {getDisplayNameWithNickname(candidate)}
                      </div>
                      <div className="text-[11px] theme-muted-text truncate">
                        {[candidate.branch, candidate.occupation].filter(Boolean).join(' · ') || 'สมาชิกในผัง'}
                      </div>
                    </div>
                    <span
                      style={{ backgroundColor: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg"
                    >
                      เชื่อมโยง
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
