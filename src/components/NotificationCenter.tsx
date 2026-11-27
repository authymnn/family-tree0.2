import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Clock, Sparkles, UserPlus, Edit3, X } from 'lucide-react';
import { FamilyTreeData, Person } from '../types/family';
import { ThemePalette } from '../utils/themes';
import { getDisplayNameWithNickname } from '../utils/familyOps';
import { PersonAvatar } from './PersonAvatar';

export interface ActivityNotification {
  id: string;
  message: string;
  timestamp: string; // ISO string
  personId?: string;
  kind: 'add' | 'edit' | 'system';
  isRemote?: boolean;
}

interface NotificationCenterProps {
  data: FamilyTreeData;
  notifications: ActivityNotification[];
  lastReadAt: string;
  palette: ThemePalette;
  onMarkAllRead: () => void;
  onSelectPerson: (personId: string) => void;
}

function formatRelativeThaiTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'เมื่อสักครู่';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ชม. ที่แล้ว`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'เมื่อวาน';
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function formatExactThaiDateTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  return new Date(ts).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function findMentionedPerson(members: Record<string, Person>, message: string): Person | undefined {
  const list = Object.values(members);
  for (const m of list) {
    if (m.firstName && message.includes(m.firstName)) {
      return m;
    }
  }
  return undefined;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  data,
  notifications,
  lastReadAt,
  palette,
  onMarkAllRead,
  onSelectPerson,
}) => {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Refresh relative timestamps every minute while open
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60000);
    return () => window.clearInterval(id);
  }, [open]);

  // Close popup when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Combine live/stored activity feed + member updatedAt history (works even on a fresh phone!)
  const feedItems = useMemo(() => {
    const items: Array<ActivityNotification & { person?: Person }> = [];

    for (const n of notifications) {
      const person = n.personId
        ? data.members[n.personId]
        : findMentionedPerson(data.members, n.message);
      items.push({ ...n, person, personId: person?.id ?? n.personId });
    }

    // Derive recent member updates directly from the tree data so history is always rich
    const recentMembers = Object.values(data.members)
      .filter((m) => m.updatedAt || m.createdAt)
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt))
      .slice(0, 25);

    for (const m of recentMembers) {
      const tsIso = m.updatedAt || m.createdAt;
      const tsMs = Date.parse(tsIso);
      if (Number.isNaN(tsMs)) continue;

      // Skip if we already have a live log entry for this person within 2 minutes
      const duplicate = items.some((it) => {
        const itMs = Date.parse(it.timestamp);
        return (
          it.personId === m.id &&
          !Number.isNaN(itMs) &&
          Math.abs(itMs - tsMs) < 120000
        );
      });
      if (duplicate) continue;

      const createdMs = Date.parse(m.createdAt || '');
      const isNewAdd = !Number.isNaN(createdMs) && Math.abs(tsMs - createdMs) < 5000;
      const label = getDisplayNameWithNickname(m);

      items.push({
        id: `member_${m.id}_${tsIso}`,
        message: isNewAdd
          ? `เพิ่มสมาชิกใหม่: ${label}`
          : `ข้อมูลของ ${label} ได้รับการอัปเดต`,
        timestamp: tsIso,
        personId: m.id,
        person: m,
        kind: isNewAdd ? 'add' : 'edit',
        isRemote: true,
      });
    }

    return items
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 35);
  }, [notifications, data.members]);

  const lastReadMs = Date.parse(lastReadAt || '') || 0;

  const unreadCount = useMemo(() => {
    if (lastReadMs === 0) {
      // First visit: count only live remote notifications received during this session
      return notifications.filter((n) => n.isRemote).length;
    }
    return feedItems.filter((item) => {
      const t = Date.parse(item.timestamp);
      return !Number.isNaN(t) && t > lastReadMs && item.isRemote !== false;
    }).length;
  }, [feedItems, notifications, lastReadMs]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && unreadCount > 0) {
        // Mark read shortly after opening so user can see which ones were new first
        setTimeout(() => onMarkAllRead(), 1200);
      }
      return next;
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Facebook-style Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        style={
          open
            ? { backgroundColor: palette.primarySoft, color: palette.primary, borderColor: palette.primary }
            : { backgroundColor: palette.bgSubtle, borderColor: palette.border }
        }
        className="relative p-2 rounded-xl border hover:opacity-85 transition-all cursor-pointer"
        title="การแจ้งเตือน — ดูประวัติการอัปเดตข้อมูลสมาชิกย้อนหลัง"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Top-Right Notification Dropdown Popup */}
      {open && (
        <div
          style={{
            backgroundColor: palette.bgSurface,
            borderColor: palette.border,
            color: palette.textMain,
          }}
          className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-16px)] sm:w-96 max-h-[75vh] rounded-2xl border shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in"
        >
          {/* Popup Header */}
          <div
            style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border }}
            className="px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" style={{ color: palette.primary }} />
              <h3 className="text-sm font-bold font-serif-thai">การแจ้งเตือน & อัปเดตล่าสุด</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onMarkAllRead}
                style={{ color: palette.primary }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold hover:bg-black/5 cursor-pointer"
                title="ทำเครื่องหมายว่าอ่านทั้งหมดแล้ว"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                อ่านแล้ว
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Notification List */}
          <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: palette.border }}>
            {feedItems.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs theme-muted-text space-y-2">
                <Bell className="w-7 h-7 mx-auto opacity-30" />
                <p>ยังไม่มีประวัติการแจ้งเตือน</p>
              </div>
            ) : (
              feedItems.map((item) => {
                const ts = Date.parse(item.timestamp);
                const isUnread =
                  lastReadMs > 0 && !Number.isNaN(ts) && ts > lastReadMs && item.isRemote !== false;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.personId && data.members[item.personId]) {
                        onSelectPerson(item.personId);
                        setOpen(false);
                      }
                    }}
                    style={{
                      backgroundColor: isUnread ? `${palette.primarySoft}99` : 'transparent',
                      borderColor: palette.border,
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-start gap-3 text-left transition-colors ${
                      item.personId ? 'hover:bg-black/5 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {/* Avatar or Event Icon */}
                    <div className="relative shrink-0 mt-0.5">
                      {item.person ? (
                        <PersonAvatar person={item.person} size="sm" />
                      ) : (
                        <div
                          style={{ backgroundColor: palette.primarySoft, color: palette.primary }}
                          className="w-9 h-9 rounded-full flex items-center justify-center"
                        >
                          <Sparkles className="w-4 h-4" />
                        </div>
                      )}
                      <span
                        style={{
                          backgroundColor:
                            item.kind === 'add'
                              ? '#10B981'
                              : item.kind === 'edit'
                                ? palette.primary
                                : palette.accent,
                        }}
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full text-white flex items-center justify-center ring-2 ring-white"
                      >
                        {item.kind === 'add' ? (
                          <UserPlus className="w-2.5 h-2.5" />
                        ) : item.kind === 'edit' ? (
                          <Edit3 className="w-2.5 h-2.5" />
                        ) : (
                          <Sparkles className="w-2.5 h-2.5" />
                        )}
                      </span>
                    </div>

                    {/* Text & Timestamp */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug font-medium break-words">
                        {item.message}
                      </p>
                      <div
                        style={{ color: isUnread ? palette.primary : palette.textMuted }}
                        className="flex items-center gap-1.5 mt-1 text-[10.5px] font-medium"
                      >
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{formatRelativeThaiTime(item.timestamp)}</span>
                        <span className="opacity-60">· {formatExactThaiDateTime(item.timestamp)} น.</span>
                      </div>
                    </div>

                    {isUnread && (
                      <span
                        style={{ backgroundColor: palette.primary }}
                        className="w-2.5 h-2.5 rounded-full shrink-0 mt-2"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Hint */}
          <div
            style={{ backgroundColor: palette.bgSubtle, borderColor: palette.border, color: palette.textMuted }}
            className="px-4 py-2 border-t text-[10.5px] text-center shrink-0"
          >
            คลิกที่รายการเพื่อเปิดดูข้อมูลสมาชิกคนนั้นบนผังทันที
          </div>
        </div>
      )}
    </div>
  );
};
