import React, { useMemo, useState } from 'react';
import {
  Search,
  Heart,
  Phone,
  MapPin,
  StickyNote,
  X,
  Users,
  Layers,
  TreePine,
  ArrowLeft,
  Calendar,
  Briefcase,
  Image as ImageIcon,
} from 'lucide-react';
import { FamilyTreeData, Person, ThemeSettings } from '../types/family';
import { ThemePalette } from '../utils/themes';
import { calculateAge, formatThaiDate } from '../utils/dateUtils';
import { getChildrenOf, getDisplayNameWithNickname, getFullName } from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';
import { TreeCanvas } from './TreeCanvas';

interface SimpleViewProps {
  data: FamilyTreeData;
  generationMap: Record<string, number>;
  branches: string[];
  themeSettings: ThemeSettings;
  palette: ThemePalette;
  onExitSimpleMode: () => void;
}

export const SimpleView: React.FC<SimpleViewProps> = ({
  data,
  generationMap,
  branches,
  themeSettings,
  palette,
  onExitSimpleMode,
}) => {
  const [subMode, setSubMode] = useState<'outline' | 'tree'>('outline');
  const [query, setQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  const groupedByGeneration = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<number, Person[]>();
    for (const m of Object.values(data.members)) {
      if (branchFilter !== 'ALL' && (m.branch || 'ไม่ระบุสาย') !== branchFilter) continue;
      if (q) {
        const hay = [
          m.firstName,
          m.lastName,
          m.nickname,
          m.branch,
          m.occupation,
          m.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const g = generationMap[m.id] ?? 1;
      const arr = groups.get(g) ?? [];
      arr.push(m);
      groups.set(g, arr);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([gen, members]) => ({
        gen,
        members: members.sort((a, b) => a.firstName.localeCompare(b.firstName, 'th')),
      }));
  }, [data.members, generationMap, query, branchFilter]);

  const selectedPerson = selectedPersonId ? data.members[selectedPersonId] ?? null : null;

  return (
    <div
      style={{ backgroundColor: palette.bgApp, color: palette.textMain }}
      className="h-screen w-screen flex flex-col overflow-hidden"
    >
      {/* Elder-Friendly Clean Top Bar */}
      <header
        style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
        className="shrink-0 border-b px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs z-30"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{ backgroundColor: palette.primary }}
            className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0"
          >
            <TreePine className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold font-serif-thai truncate">
                {data.clanName}
              </h1>
              <span
                style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
              >
                โหมดดูง่าย
              </span>
            </div>
            <p style={{ color: palette.textMuted }} className="text-xs">
              ตัวอักษรใหญ่ อ่านสบายตา ไม่ต้องกลัวกดแก้ไขพลาด ({Object.keys(data.members).length} สมาชิก)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle between Simple Generation Cards vs Clean Visual Tree */}
          <div
            style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
            className="flex items-center p-1 rounded-xl border"
          >
            <button
              onClick={() => setSubMode('outline')}
              style={
                subMode === 'outline'
                  ? { backgroundColor: palette.primary, color: '#fff' }
                  : { color: palette.textMuted }
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              ดูเรียงตามรุ่น
            </button>
            <button
              onClick={() => setSubMode('tree')}
              style={
                subMode === 'tree'
                  ? { backgroundColor: palette.primary, color: '#fff' }
                  : { color: palette.textMuted }
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              <TreePine className="w-4 h-4" />
              ดูผังภาพ
            </button>
          </div>

          <button
            onClick={onExitSimpleMode}
            style={{ borderColor: palette.border, backgroundColor: palette.bgSurface }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-medium hover:opacity-85 transition-opacity cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับโหมดแก้ไข
          </button>
        </div>
      </header>

      {/* Main Content */}
      {subMode === 'outline' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Big Search & Branch Chips */}
            <div
              style={{ backgroundColor: palette.bgSurface, borderColor: palette.border }}
              className="p-4 rounded-2xl border shadow-xs space-y-3"
            >
              <div className="relative">
                <Search
                  style={{ color: palette.textMuted }}
                  className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="พิมพ์ชื่อ หรือชื่อเล่น เพื่อหาญาติ..."
                  style={{
                    backgroundColor: palette.bgSubtle,
                    borderColor: palette.border,
                    color: palette.textMain,
                  }}
                  className="w-full pl-11 pr-4 py-3 text-base rounded-xl border focus:outline-none"
                />
              </div>

              {branches.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBranchFilter('ALL')}
                    style={
                      branchFilter === 'ALL'
                        ? { backgroundColor: palette.primary, color: '#fff' }
                        : { backgroundColor: palette.bgSubtle, color: palette.textMain }
                    }
                    className="px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer"
                  >
                    ทุกสายตระกูล
                  </button>
                  {branches.map((b) => (
                    <button
                      key={b}
                      onClick={() => setBranchFilter(b)}
                      style={
                        branchFilter === b
                          ? { backgroundColor: palette.accent, color: '#fff' }
                          : { backgroundColor: palette.bgSubtle, color: palette.textMain }
                      }
                      className="px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grouped Large Cards by Generation */}
            {groupedByGeneration.length === 0 ? (
              <div
                style={{ backgroundColor: palette.bgSurface, borderColor: palette.border, color: palette.textMuted }}
                className="p-12 rounded-2xl border text-center text-base"
              >
                ไม่พบสมาชิกที่ค้นหา
              </div>
            ) : (
              groupedByGeneration.map(({ gen, members }) => (
                <section key={gen} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span
                      style={{ backgroundColor: palette.primary }}
                      className="px-4 py-1.5 rounded-full text-white text-sm font-bold shadow-xs"
                    >
                      รุ่นที่ {gen}
                    </span>
                    <span style={{ color: palette.textMuted }} className="text-sm font-medium">
                      ({members.length} คน)
                    </span>
                    <div style={{ backgroundColor: palette.border }} className="flex-1 h-px" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {members.map((member) => {
                      const age = calculateAge(member.birthDate, member.deathDate, member.isDeceased);
                      const spouses = member.spouses
                        .map((s) => data.members[s.spouseId])
                        .filter(Boolean);
                      const children = getChildrenOf(data.members, member.id);

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedPersonId(member.id)}
                          style={{
                            backgroundColor: palette.bgSurface,
                            borderColor: palette.border,
                          }}
                          className="w-full text-left p-5 rounded-2xl border shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col gap-3"
                        >
                          <div className="flex items-center gap-4">
                            <PersonAvatar person={member} size="xl" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                {member.nickname && (
                                  <span
                                    style={{ backgroundColor: palette.accentSoft, color: palette.accent }}
                                    className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                                  >
                                    {member.nickname}
                                  </span>
                                )}
                                {member.isDeceased && (
                                  <span
                                    style={{ backgroundColor: palette.bgSubtle, color: palette.textMuted }}
                                    className="text-xs px-2.5 py-0.5 rounded-full"
                                  >
                                    ผู้ล่วงลับ
                                  </span>
                                )}
                              </div>
                              <div className="text-lg font-bold leading-snug truncate">
                                {getFullName(member)}
                              </div>
                              <div style={{ color: palette.textMuted }} className="text-sm mt-0.5">
                                {age != null
                                  ? member.isDeceased
                                    ? `สิริอายุ ${age} ปี`
                                    : `อายุ ${age} ปี`
                                  : ''}
                                {age != null && member.branch ? ' · ' : ''}
                                {member.branch || ''}
                              </div>
                            </div>
                          </div>

                          {/* Simple Relationship Summary */}
                          <div
                            style={{ backgroundColor: palette.bgSubtle }}
                            className="p-3 rounded-xl space-y-1.5 text-sm"
                          >
                            {spouses.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Heart className="w-4 h-4 shrink-0" style={{ color: palette.accent }} />
                                <span className="truncate">
                                  คู่สมรส: <strong>{spouses.map((s) => s.nickname || s.firstName).join(', ')}</strong>
                                </span>
                              </div>
                            )}
                            {children.length > 0 && (
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 shrink-0" style={{ color: palette.primary }} />
                                <span className="truncate">
                                  บุตร ({children.length}):{' '}
                                  <strong>{children.map((c) => c.nickname || c.firstName).join(', ')}</strong>
                                </span>
                              </div>
                            )}
                            {member.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 shrink-0" style={{ color: palette.primary }} />
                                <span>{member.phone}</span>
                              </div>
                            )}
                          </div>

                          {member.notes && (
                            <div
                              style={{ backgroundColor: palette.accentSoft, color: palette.textMain }}
                              className="px-3.5 py-2.5 rounded-xl text-sm flex items-start gap-2"
                            >
                              <StickyNote className="w-4 h-4 shrink-0 mt-0.5" style={{ color: palette.accent }} />
                              <span className="line-clamp-2">{member.notes}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      ) : (
        <TreeCanvas
          data={data}
          selectedPersonId={selectedPersonId}
          highlightIds={null}
          focusRootId={null}
          onClearFocusRoot={() => {}}
          compact={false}
          onToggleCompact={() => {}}
          collapsedIds={collapsedIds}
          onToggleCollapse={(id) =>
            setCollapsedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onExpandAll={() => setCollapsedIds(new Set())}
          onCollapseToLevel2={() => {}}
          onSelectPerson={(id) => setSelectedPersonId(id)}
          onQuickAdd={() => {}}
          onAddStandalone={() => {}}
          branches={branches}
          themeSettings={themeSettings}
          palette={palette}
          readOnly
        />
      )}

      {/* Large-Text Easy Profile Modal */}
      {selectedPerson && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSelectedPersonId(null)}
        >
          <div
            style={{
              backgroundColor: palette.bgSurface,
              borderColor: palette.border,
              color: palette.textMain,
            }}
            className="w-full max-w-xl max-h-[88vh] rounded-3xl shadow-2xl border overflow-hidden flex flex-col animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
              className="px-6 py-4 border-b flex items-center justify-between"
            >
              <span
                style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
                className="text-sm font-bold px-3 py-1 rounded-full"
              >
                รุ่นที่ {generationMap[selectedPerson.id] ?? 1}
              </span>
              <button
                onClick={() => setSelectedPersonId(null)}
                className="p-2 rounded-xl hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-base">
              <div className="flex items-center gap-4">
                <PersonAvatar person={selectedPerson} size="xl" />
                <div>
                  {selectedPerson.nickname && (
                    <span
                      style={{ backgroundColor: palette.accentSoft, color: palette.accent }}
                      className="inline-block text-sm font-bold px-3 py-0.5 rounded-full mb-1"
                    >
                      {selectedPerson.nickname}
                    </span>
                  )}
                  <h2 className="text-2xl font-bold font-serif-thai">
                    {getFullName(selectedPerson)}
                  </h2>
                  <p style={{ color: palette.textMuted }} className="text-sm mt-0.5">
                    {selectedPerson.branch || 'สมาชิกตระกูล'}
                    {calculateAge(selectedPerson.birthDate, selectedPerson.deathDate, selectedPerson.isDeceased) != null &&
                      ` · อายุ ${calculateAge(selectedPerson.birthDate, selectedPerson.deathDate, selectedPerson.isDeceased)} ปี`}
                  </p>
                </div>
              </div>

              {selectedPerson.notes && (
                <div
                  style={{ backgroundColor: palette.accentSoft, borderColor: palette.accent }}
                  className="p-4 rounded-2xl border-l-4 space-y-1"
                >
                  <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: palette.accent }}>
                    <StickyNote className="w-4 h-4" />
                    หมายเหตุสำคัญ
                  </div>
                  <p className="text-base leading-relaxed whitespace-pre-wrap">{selectedPerson.notes}</p>
                </div>
              )}

              <div className="space-y-2.5 text-sm sm:text-base">
                {selectedPerson.birthDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 shrink-0" style={{ color: palette.primary }} />
                    <span>เกิดวันที่ {formatThaiDate(selectedPerson.birthDate, 'full')}</span>
                  </div>
                )}
                {selectedPerson.occupation && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 shrink-0" style={{ color: palette.primary }} />
                    <span>อาชีพ: {selectedPerson.occupation}</span>
                  </div>
                )}
                {selectedPerson.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 shrink-0" style={{ color: palette.primary }} />
                    <a
                      href={`tel:${selectedPerson.phone}`}
                      style={{ color: palette.primary }}
                      className="font-semibold underline"
                    >
                      {selectedPerson.phone}
                    </a>
                  </div>
                )}
                {selectedPerson.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 shrink-0" style={{ color: palette.primary }} />
                    <span>ที่อยู่: {selectedPerson.address}</span>
                  </div>
                )}
              </div>

              {selectedPerson.bio && (
                <div
                  style={{ backgroundColor: palette.bgSubtle }}
                  className="p-4 rounded-2xl text-sm sm:text-base leading-relaxed whitespace-pre-wrap"
                >
                  {selectedPerson.bio}
                </div>
              )}

              {/* Photo Gallery in Easy Mode */}
              {selectedPerson.gallery && selectedPerson.gallery.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" style={{ color: palette.primary }} />
                    อัลบั้มภาพ ({selectedPerson.gallery.length} รูป)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedPerson.gallery.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightboxUrl(photo.url)}
                        className="aspect-square rounded-xl overflow-hidden border border-black/10 cursor-pointer hover:opacity-90"
                      >
                        <img src={photo.url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clickable Immediate Relatives */}
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: palette.border }}>
                {selectedPerson.parentIds.length > 0 && (
                  <div>
                    <div style={{ color: palette.textMuted }} className="text-xs font-semibold mb-1.5">
                      พ่อ / แม่
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPerson.parentIds.map((pid) => {
                        const p = data.members[pid];
                        if (!p) return null;
                        return (
                          <button
                            key={pid}
                            onClick={() => setSelectedPersonId(pid)}
                            style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium cursor-pointer"
                          >
                            <PersonAvatar person={p} size="xs" />
                            {getDisplayNameWithNickname(p)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {getChildrenOf(data.members, selectedPerson.id).length > 0 && (
                  <div>
                    <div style={{ color: palette.textMuted }} className="text-xs font-semibold mb-1.5">
                      บุตร
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {getChildrenOf(data.members, selectedPerson.id).map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setSelectedPersonId(child.id)}
                          style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium cursor-pointer"
                        >
                          <PersonAvatar person={child} size="xs" />
                          {getDisplayNameWithNickname(child)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="ขยายภาพ"
            className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
};
