'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ThreadNote, NoteReply } from './ThreadModal';

export interface Course {
  course_id: number; title: string; start_date: string | null; end_date: string | null;
  status: string; total_sessions: number | null; course_type: string;
}
export interface Enrollment { enrollment_id: number; course_id: number; completion_status: string; }
export interface CurriculumStats {
  total_sessions: number; sessions_with_records: number; sessions_without_records: number;
  stats: { enrollment_id: number; student_name: string; student_number: string; attended: number; absent: number; total: number; attendance_pct: number }[];
}
export interface LastSession {
  session_id: number; week_number: number; title: string; session_type: string;
  date_recorded: string | null; present: number; absent: number; makeup: number;
  absent_students: { name: string; student_number: string; notes: string | null }[];
}
export interface AttendanceTrend { date: string; present: number; absent: number; makeup: number; }
export interface Note {
  id: number; content: string; created_at: string | null; author_name: string; author_role: string;
  curriculum_session_id: number | null; parent_id: number | null; replies: NoteReply[]; course_id?: number; course_title?: string;
}

const statusColors: Record<string, string> = { Active: '#10B981', Inactive: '#64748B' };
const enrColors: Record<string, string> = { Completed: '#10B981', Ongoing: '#0EA5E9', Dropped: '#F87171' };

const I = (d: string, s = 18, c = 'currentColor') => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const PATHS = {
  note: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
};

interface Props {
  course: Course;
  enrollments: Enrollment[];
  curriculumStats: CurriculumStats | undefined;
  lastSession: LastSession | null | undefined;
  attendanceTrend: AttendanceTrend[] | undefined;
  notes: Note[] | undefined;
  isExpanded: boolean;
  expandLoading: boolean;
  noteText: string;
  noteSending: boolean;
  noteSent: boolean;
  onToggle: () => void;
  onNoteChange: (text: string) => void;
  onNoteSend: () => void;
  onOpenThread: (note: ThreadNote) => void;
  fmtTime: (iso: string | null) => string;
  t: (key: string, vars?: Record<string, string>) => string;
}

export default function CourseCard({
  course: c, enrollments: ces, curriculumStats: cStats, lastSession, attendanceTrend,
  notes, isExpanded, expandLoading, noteText, noteSending, noteSent,
  onToggle, onNoteChange, onNoteSend, onOpenThread, fmtTime, t,
}: Props) {
  const ongoing = ces.filter(e => e.completion_status === 'Ongoing').length;
  const completed = ces.filter(e => e.completion_status === 'Completed').length;
  const dropped = ces.filter(e => e.completion_status === 'Dropped').length;
  const completionRate = ces.length > 0 ? Math.round((completed / ces.length) * 100) : 0;
  const rateColor = completionRate >= 75 ? '#10B981' : completionRate >= 40 ? '#F59E0B' : '#F87171';
  const conductedSessions = cStats?.sessions_with_records ?? 0;
  const plannedSessions = cStats?.total_sessions ?? 0;
  const sessionPct = plannedSessions > 0 ? Math.round((conductedSessions / plannedSessions) * 100) : 0;
  const isOnline = c.course_type === 'online';
  const chronicAbsent = (cStats?.stats ?? []).filter(s => s.absent >= 3);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: isExpanded ? 'var(--surface-2)' : 'transparent', transition: 'background 0.2s' }}>
      {/* ── Compact row ── */}
      <div
        onClick={onToggle}
        style={{ padding: '14px 16px', cursor: 'pointer', userSelect: 'none', borderBottom: isExpanded ? '1px solid var(--border-soft)' : 'none' }}
        onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
        onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: plannedSessions > 0 || ces.length > 0 ? 8 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <p className="text-fg" style={{ fontSize: 14, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                <span style={{
                  padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                  background: isOnline ? '#8B5CF618' : '#F59E0B18',
                  color: isOnline ? '#8B5CF6' : '#F59E0B',
                  border: `1px solid ${isOnline ? '#8B5CF640' : '#F59E0B40'}`,
                }}>{t(`course.type_${c.course_type || 'onsite'}`)}</span>
              </div>
              <p className="text-fg2" style={{ fontSize: 12, marginTop: 0 }}>{c.start_date || '—'} → {c.end_date || '—'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginInlineStart: 12 }}>
            {conductedSessions > 0 && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#0EA5E9', fontSize: 15, fontWeight: 800, margin: 0, fontFamily: "'Syne', sans-serif" }}>{conductedSessions}</p>
                <p className="text-fg3" style={{ fontSize: 9, margin: 0 }}>/ {plannedSessions}</p>
              </div>
            )}
            {ces.length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: rateColor, fontSize: 15, fontWeight: 700, margin: 0 }}>{completionRate}%</p>
                <p className="text-fg3" style={{ fontSize: 11, margin: 0 }}>{completed}/{ces.length}</p>
              </div>
            )}
            <span style={{
              padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: `${statusColors[c.status]}18`, color: statusColors[c.status],
              border: `1px solid ${statusColors[c.status]}40`,
            }}>{t(`course.status_${c.status.toLowerCase()}`)}</span>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        {(plannedSessions > 0 || ces.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: plannedSessions > 0 && ces.length > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
            {plannedSessions > 0 && (
              <div><div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
                <div style={{ width: `${sessionPct}%`, height: '100%', background: '#0EA5E9', borderRadius: 99, transition: 'width 0.6s ease' }} />
              </div></div>
            )}
            {ces.length > 0 && (
              <div><div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
                <div style={{ width: `${completionRate}%`, height: '100%', background: rateColor, borderRadius: 99, transition: 'width 0.6s ease' }} />
              </div></div>
            )}
          </div>
        )}
      </div>

      {/* ── Expanded panel ── */}
      {isExpanded && (
        <div style={{ padding: '18px 20px' }}>
          {expandLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map(i => <div key={i} className="sk" style={{ height: 60, borderRadius: 10 }} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {/* Left: last session + chronic absentees */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    {I(PATHS.note, 12, 'var(--fg-3)')}{' '}{t('dash.last_session')}
                  </p>
                  {lastSession == null ? (
                    <p className="text-fg3" style={{ fontSize: 13 }}>{t('dash.no_last_session')}</p>
                  ) : (() => {
                    const ls = lastSession!;
                    const total = ls.present + ls.absent + ls.makeup;
                    return (
                      <>
                        <p className="text-fg" style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                          {t('dash.week_label', { n: String(ls.week_number) })} — {ls.title}
                        </p>
                        {ls.date_recorded && (
                          <p className="text-fg3" style={{ fontSize: 11, marginBottom: 10 }}>
                            {t('dash.last_session_recorded')} {ls.date_recorded}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          {[
                            { val: ls.present, color: '#10B981', label: t('att.present') },
                            { val: ls.absent, color: '#F87171', label: t('att.absent') },
                            { val: ls.makeup, color: '#F59E0B', label: t('att.makeup') },
                          ].map(({ val, color, label }) => (
                            <div key={label} style={{ flex: 1, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
                              <p style={{ color, fontSize: 18, fontWeight: 800, margin: 0, fontFamily: "'Syne', sans-serif" }}>{val}</p>
                              <p style={{ color: 'var(--fg-3)', fontSize: 9, margin: 0, textTransform: 'uppercase' }}>{label}</p>
                            </div>
                          ))}
                        </div>
                        {total > 0 && (
                          <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 10 }}>
                            <div style={{ display: 'flex', height: '100%' }}>
                              <div style={{ width: `${(ls.present / total) * 100}%`, background: '#10B981' }} />
                              <div style={{ width: `${(ls.makeup / total) * 100}%`, background: '#F59E0B' }} />
                              <div style={{ width: `${(ls.absent / total) * 100}%`, background: '#F87171' }} />
                            </div>
                          </div>
                        )}
                        {ls.absent_students.length > 0 && (
                          <div>
                            <p style={{ fontSize: 10, color: '#F87171', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                              {t('dash.absent_students_last')}
                            </p>
                            {ls.absent_students.map((s, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-soft)' }}>
                                <span style={{ fontSize: 12, color: 'var(--fg)' }}>{s.name}</span>
                                <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'monospace' }}>{s.student_number}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {chronicAbsent.length > 0 && (
                  <div style={{ background: '#F8717110', border: '1px solid #F8717130', borderRadius: 12, padding: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#F87171', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {t('dash.chronic_absent')} — {t('dash.chronic_absent_sub')}
                    </p>
                    {chronicAbsent.slice(0, 5).map(s => (
                      <div key={s.enrollment_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(248,113,113,0.15)' }}>
                        <span style={{ fontSize: 12, color: 'var(--fg)' }}>{s.student_name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#F87171', fontWeight: 700 }}>{t('dash.absence_count', { n: String(s.absent) })}</span>
                          <div style={{ width: 50, background: 'var(--border-soft)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${s.attendance_pct}%`, height: '100%', background: s.attendance_pct >= 75 ? '#10B981' : s.attendance_pct >= 50 ? '#F59E0B' : '#F87171', borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{s.attendance_pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: attendance chart + note composer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    {I(PATHS.chart, 12, 'var(--fg-3)')}{' '}{t('dash.att_by_session')}
                  </p>
                  {!attendanceTrend || attendanceTrend.length === 0 ? (
                    <p className="text-fg3" style={{ fontSize: 13 }}>{t('att.no_records')}</p>
                  ) : (
                    <div dir="ltr">
                      <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={attendanceTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={12}>
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--fg-3)' }} />
                          <YAxis tick={{ fontSize: 9, fill: 'var(--fg-3)' }} allowDecimals={false} />
                          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)' }}
                            labelFormatter={d => `${t('att.session_label')}: ${d}`} />
                          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                          <Bar dataKey="present" name={t('att.present')} stackId="a" fill="#10B981" />
                          <Bar dataKey="absent" name={t('att.absent')} stackId="a" fill="#F87171" />
                          <Bar dataKey="makeup" name={t('att.makeup')} stackId="a" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Note composer */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    {I(PATHS.note, 12, 'var(--fg-3)')}{' '}{t('dash.note_to_supervisor')}
                  </p>
                  <textarea
                    value={noteText}
                    onChange={e => onNoteChange(e.target.value)}
                    placeholder={t('dash.note_placeholder')}
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <button
                      onClick={onNoteSend}
                      disabled={!noteText.trim() || noteSending}
                      style={{ padding: '8px 18px', background: noteSent ? '#10B981' : 'linear-gradient(135deg, #0EA5E9, #0284C7)', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!noteText.trim() || noteSending) ? 0.5 : 1, transition: 'all 0.2s' }}
                    >
                      {noteSent ? t('dash.note_sent') : noteSending ? '...' : t('dash.send_note')}
                    </button>
                  </div>
                  {(notes ?? []).length > 0 && (
                    <div style={{ marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{t('dash.past_notes')}</p>
                      {(notes ?? []).slice(0, 3).map(n => {
                        const hasSupReply = (n.replies || []).some(r => r.author_role === 'supervisor');
                        return (
                          <div key={n.id} onClick={() => onOpenThread({ ...n })}
                            style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, borderInlineStart: `3px solid ${hasSupReply ? '#10B981' : '#0EA5E9'}60`, cursor: 'pointer' }}>
                            <p style={{ fontSize: 12, color: 'var(--fg)', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                              {n.content.startsWith('📋') ? n.content.split('\n').slice(4).join(' ').trim() || n.content : n.content}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              <p style={{ fontSize: 10, color: 'var(--fg-3)', margin: 0 }}>{n.author_name} · {fmtTime(n.created_at)}</p>
                              {(n.replies || []).length > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: hasSupReply ? '#10B981' : '#0EA5E9', background: hasSupReply ? '#10B98115' : '#0EA5E915', padding: '1px 7px', borderRadius: 20 }}>
                                  {hasSupReply ? '↩ ' : ''}{(n.replies || []).length} {t('dash.replies')}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(notes ?? []).length === 0 && (
                    <p className="text-fg3" style={{ fontSize: 12, marginTop: 8 }}>{t('dash.no_notes')}</p>
                  )}
                </div>

                {ces.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {([['Ongoing', ongoing, t('enr.status_ongoing')], ['Completed', completed, t('enr.status_completed')], ['Dropped', dropped, t('enr.status_dropped')]] as [string, number, string][])
                      .filter(([, count]) => count > 0)
                      .map(([key, count, label]) => (
                        <span key={key} style={{ background: `${enrColors[key]}15`, color: enrColors[key], border: `1px solid ${enrColors[key]}30`, fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>
                          {count} {label}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
