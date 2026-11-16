'use client';
import { useState } from 'react';

export interface NoteReply {
  id: number; content: string; parent_id: number;
  created_at: string | null; author_name: string; author_role: string;
}

export interface TeacherNote {
  id: number; course_id: number; course_title: string; content: string;
  created_at: string | null; author_name: string; author_role: string;
  curriculum_session_id: number | null; parent_id: number | null;
  replies: NoteReply[];
}

export interface RosterEntry {
  enrollment_id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  student_number: string;
  status: 'present' | 'absent' | 'makeup' | null;
  notes: string | null;
}

interface ParsedReport {
  isReport: boolean;
  sessionTitle: string;
  weekInfo: string;
  present: number | null;
  absent: number | null;
  makeup: number | null;
  total: number | null;
  body: string;
}

function parseReport(content: string): ParsedReport {
  if (!content.startsWith('📋')) {
    return { isReport: false, sessionTitle: '', weekInfo: '', present: null, absent: null, makeup: null, total: null, body: content };
  }
  const lines = content.split('\n');
  const titleMatch = lines[0]?.match(/📋.*?—\s*(.+)/);
  const sessionTitle = titleMatch ? titleMatch[1].trim() : '';
  const weekInfo = lines[1]?.trim() || '';
  const statLine = lines.find(l => l.includes('👥')) || '';
  const presentMatch = statLine.match(/Present[:\s]+(\d+)\/(\d+)/i) || statLine.match(/Présente[:\s]+(\d+)\/(\d+)/i) || statLine.match(/حاضرة[:\s]+(\d+)\/(\d+)/i);
  const absentMatch = statLine.match(/Absent[:\s]+(\d+)/i) || statLine.match(/Absente[:\s]+(\d+)/i) || statLine.match(/غائبة[:\s]+(\d+)/i);
  const makeupMatch = statLine.match(/Makeup[:\s]+(\d+)/i) || statLine.match(/Rattrapage[:\s]+(\d+)/i) || statLine.match(/تعويض[:\s]+(\d+)/i);
  const present = presentMatch ? parseInt(presentMatch[1]) : null;
  const total = presentMatch ? parseInt(presentMatch[2]) : null;
  const absent = absentMatch ? parseInt(absentMatch[1]) : null;
  const makeup = makeupMatch ? parseInt(makeupMatch[1]) : null;
  const bodyStart = lines.findIndex(l => l.includes('👥'));
  const body = bodyStart >= 0 ? lines.slice(bodyStart + 1).join('\n').trim() : '';
  return { isReport: true, sessionTitle, weekInfo, present, absent, makeup, total, body };
}

interface Props {
  note: TeacherNote;
  roster?: RosterEntry[];
  rosterLoading?: boolean;
  replyContent: string;
  replySending: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onReplyChange: (v: string) => void;
  onSend: () => void;
  fmtTime: (iso: string | null) => string;
  t: (key: string, vars?: Record<string, string>) => string;
}

export default function NoteThreadModal({ note, roster, rosterLoading, replyContent, replySending, onClose, onDelete, onReplyChange, onSend, fmtTime, t }: Props) {
  const parsed = parseReport(note.content);
  const allMessages = [
    { id: note.id, content: note.content, author_name: note.author_name, author_role: note.author_role, created_at: note.created_at, isRoot: true },
    ...(note.replies || []).map(r => ({ ...r, isRoot: false })),
  ];

  // Which stat box is currently selected (null = none → roster hidden)
  const [activeGroup, setActiveGroup] = useState<'present' | 'absent' | 'makeup' | null>(null);

  const statBoxes: { key: 'present' | 'absent' | 'makeup'; label: string; val: string | number; color: string; bg: string }[] = parsed.isReport ? [
    { key: 'present', label: t('att.present'), val: `${parsed.present ?? 0}${parsed.total !== null ? `/${parsed.total}` : ''}`, color: '#10B981', bg: '#10B98112' },
    { key: 'absent',  label: t('att.absent'),  val: parsed.absent  ?? 0, color: '#F87171', bg: '#F8717112' },
    { key: 'makeup',  label: t('att.makeup'),  val: parsed.makeup  ?? 0, color: '#0EA5E9', bg: '#0EA5E912' },
  ] : [];

  const filteredRoster = roster && activeGroup
    ? roster.filter(r => r.status === activeGroup)
    : [];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#0EA5E915', color: '#0EA5E9', border: '1px solid #0EA5E940' }}>{note.course_title}</span>
              {parsed.isReport && (
                <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#8B5CF615', color: '#8B5CF6', border: '1px solid #8B5CF640' }}>
                  📋 {t('att.session_report')}
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>
              {parsed.isReport ? parsed.sessionTitle : t('dash.note_to_supervisor')}
            </h2>
            {parsed.isReport && parsed.weekInfo && (
              <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: '3px 0 0' }}>{parsed.weekInfo}</p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
        </div>

        {/* Clickable attendance stat boxes — session reports only */}
        {parsed.isReport && parsed.present !== null && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, padding: '14px 22px', borderBottom: activeGroup ? 'none' : '1px solid var(--border)' }}>
            {statBoxes.map(s => {
              const isActive = activeGroup === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveGroup(isActive ? null : s.key)}
                  style={{
                    textAlign: 'center', padding: '10px 6px', borderRadius: 10,
                    background: isActive ? s.color + '22' : s.bg,
                    border: `2px solid ${isActive ? s.color : s.color + '30'}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                    outline: 'none',
                    boxShadow: isActive ? `0 0 0 3px ${s.color}25` : 'none',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                  {isActive && (
                    <div style={{ fontSize: 10, color: s.color, marginTop: 4, fontWeight: 700 }}>▲</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Roster panel — shown when a stat box is active */}
        {parsed.isReport && activeGroup && (
          <div style={{ borderBottom: '1px solid var(--border)', padding: '12px 22px', background: 'var(--surface-2)' }}>
            {rosterLoading ? (
              <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: 0, textAlign: 'center' }}>{t('common.loading')}</p>
            ) : filteredRoster.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: 0, textAlign: 'center' }}>—</p>
            ) : (
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 7, paddingRight: 4 }}>
                {filteredRoster.map(s => {
                  const box = statBoxes.find(b => b.key === activeGroup)!;
                  return (
                    <span key={s.enrollment_id} style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                      background: box.bg, color: 'var(--fg)',
                      border: `1px solid ${box.color}40`,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {s.first_name} {s.last_name}
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'monospace', fontWeight: 400 }}>
                        {s.student_number}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Thread messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {allMessages.map(msg => {
            const isSupervisor = msg.author_role === 'supervisor';
            const bubbleColor = isSupervisor ? '#0EA5E9' : '#8B5CF6';
            const bodyText = msg.isRoot && parsed.isReport ? (parsed.body || '—') : msg.content;
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSupervisor ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--fg-2)' }}>{msg.author_name}</span>
                  <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${bubbleColor}15`, color: bubbleColor }}>{msg.author_role}</span>
                  <span>{fmtTime(msg.created_at)}</span>
                </div>
                <div style={{
                  maxWidth: '85%', padding: '12px 16px',
                  borderRadius: isSupervisor ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: isSupervisor ? '#0EA5E912' : 'var(--surface-2)',
                  border: `1px solid ${bubbleColor}25`,
                  fontSize: 13, lineHeight: 1.7, color: 'var(--fg)', whiteSpace: 'pre-wrap',
                }}>
                  {bodyText}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply box */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={replyContent}
            onChange={e => onReplyChange(e.target.value)}
            placeholder={t('dash.reply_placeholder')}
            rows={3}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, background: 'var(--input-bg)', color: 'var(--fg)', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend(); }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{t('dash.reply_hint')}</span>
            <button
              onClick={onSend}
              disabled={replySending || !replyContent.trim()}
              style={{ padding: '8px 20px', background: replyContent.trim() ? '#0EA5E9' : 'var(--border)', color: replyContent.trim() ? '#fff' : 'var(--fg-3)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: replySending || !replyContent.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {replySending ? t('common.loading') : t('dash.send_reply')}
            </button>
          </div>

          {/* Bottom action row: back (leave) + delete */}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {/* Back / leave — no X, just an arrow */}
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'transparent', color: 'var(--fg-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {t('common.close')}
            </button>
            {/* Delete note */}
            {onDelete && (
              <button
                onClick={onDelete}
                style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #F8717140', background: 'transparent', color: '#F87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#F8717112')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
                {t('common.delete')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { parseReport };
