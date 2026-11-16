'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { analyticsApi, coursesApi, enrollmentsApi, curriculumApi, attendanceApi, notesApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonKPIs, SkeletonCard } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';
import EnrollmentBarChart from '@/components/EnrollmentBarChart';
import CourseCard, { type Course, type Enrollment, type CurriculumStats, type LastSession, type AttendanceTrend, type Note } from '@/components/teacher/CourseCard';
import ThreadModal, { type ThreadNote } from '@/components/teacher/ThreadModal';

interface TeacherStats { my_courses: number; my_students: number; total_enrollments: number; completion_rate: number; }

const I = (d: string, s = 18, c = 'currentColor') => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const PATHS = {
  students: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  courses: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  enrollments: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
};

const KPI = ({ label, value, sub, accent, icon }: { label: string; value: string | number; sub?: string; accent: string; icon: string }) => (
  <div className="card" style={{ borderInlineStart: `4px solid ${accent}`, padding: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
      <p className="label-xs">{label}</p>
      <div style={{ background: `${accent}15`, borderRadius: 8, padding: 7, flexShrink: 0 }}>{I(icon, 15, accent)}</div>
    </div>
    <p style={{ color: accent, fontSize: 32, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>{value}</p>
    {sub && <p className="text-fg3" style={{ fontSize: 13, marginTop: 4 }}>{sub}</p>}
  </div>
);

export default function TeacherDashboard() {
  const { user, loading } = useRequireRole('teacher');
  const { t, dir } = useT();
  const isRtl = dir === 'rtl';
  const router = useRouter();

  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [curriculumStats, setCurriculumStats] = useState<Record<number, CurriculumStats>>({});
  const [dataLoading, setDataLoading] = useState(true);

  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [lastSessions, setLastSessions] = useState<Record<number, LastSession | null>>({});
  const [attendanceTrends, setAttendanceTrends] = useState<Record<number, AttendanceTrend[]>>({});
  const [notes, setNotes] = useState<Record<number, Note[]>>({});
  const [expandLoading, setExpandLoading] = useState<number | null>(null);

  const [noteText, setNoteText] = useState<Record<number, string>>({});
  const [noteSending, setNoteSending] = useState<number | null>(null);
  const [noteSent, setNoteSent] = useState<number | null>(null);

  const [threadNote, setThreadNote] = useState<ThreadNote | null>(null);
  const [threadReply, setThreadReply] = useState('');
  const [threadReplySending, setThreadReplySending] = useState(false);

  useEffect(() => {
    if (user?.role === 'teacher') {
      Promise.all([
        analyticsApi.teacher().then(res => setStats(res.data)).catch(() => {}),
        coursesApi.list().then(async res => {
          const courseList: Course[] = res.data;
          setCourses(courseList);
          const statsMap: Record<number, CurriculumStats> = {};
          await Promise.all(
            courseList.map(c =>
              curriculumApi.stats(c.course_id)
                .then(r => { statsMap[c.course_id] = r.data; })
                .catch(() => {})
            )
          );
          setCurriculumStats(statsMap);
        }).catch(() => {}),
        enrollmentsApi.list().then(res => setEnrollments(res.data)).catch(() => {}),
      ]).finally(() => setDataLoading(false));
    }
  }, [user]);

  const handleExpandCourse = useCallback(async (courseId: number) => {
    if (expandedCourseId === courseId) { setExpandedCourseId(null); return; }
    setExpandedCourseId(courseId);
    if (lastSessions[courseId] !== undefined && attendanceTrends[courseId] !== undefined && notes[courseId] !== undefined) return;
    setExpandLoading(courseId);
    await Promise.all([
      lastSessions[courseId] === undefined
        ? curriculumApi.lastSession(courseId)
            .then(r => setLastSessions(prev => ({ ...prev, [courseId]: r.data })))
            .catch(() => setLastSessions(prev => ({ ...prev, [courseId]: null })))
        : Promise.resolve(),
      attendanceTrends[courseId] === undefined
        ? attendanceApi.trend(courseId)
            .then(r => {
              const rows = (r.data ?? []).map((row: { date: string; present: number; absent: number; makeup: number }) => ({
                date: row.date?.slice(5) ?? row.date, present: row.present, absent: row.absent, makeup: row.makeup,
              }));
              setAttendanceTrends(prev => ({ ...prev, [courseId]: rows }));
            })
            .catch(() => setAttendanceTrends(prev => ({ ...prev, [courseId]: [] })))
        : Promise.resolve(),
      notes[courseId] === undefined
        ? notesApi.list(courseId)
            .then(r => setNotes(prev => ({ ...prev, [courseId]: r.data })))
            .catch(() => setNotes(prev => ({ ...prev, [courseId]: [] })))
        : Promise.resolve(),
    ]);
    setExpandLoading(null);
  }, [expandedCourseId, lastSessions, attendanceTrends, notes]);

  const handleSendNote = async (courseId: number) => {
    const text = (noteText[courseId] || '').trim();
    if (!text) return;
    setNoteSending(courseId);
    try {
      const res = await notesApi.create(courseId, text, lastSessions[courseId]?.session_id ?? null);
      setNotes(prev => ({ ...prev, [courseId]: [res.data, ...(prev[courseId] || [])] }));
      setNoteText(prev => ({ ...prev, [courseId]: '' }));
      setNoteSent(courseId);
      setTimeout(() => setNoteSent(null), 3000);
    } catch { } finally { setNoteSending(null); }
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—';
    return `${iso.slice(0, 10)} · ${iso.slice(11, 16)}`;
  };

  const sendThreadReply = async () => {
    if (!threadNote || !threadReply.trim()) return;
    setThreadReplySending(true);
    try {
      const res = await notesApi.reply(threadNote.id, threadReply.trim());
      setThreadNote(prev => prev ? { ...prev, replies: [...prev.replies, res.data] } : prev);
      if (threadNote.course_id) {
        setNotes(prev => ({
          ...prev,
          [threadNote.course_id!]: (prev[threadNote.course_id!] || []).map(n =>
            n.id === threadNote.id ? { ...n, replies: [...n.replies, res.data] } : n
          ),
        }));
      }
      setThreadReply('');
    } catch { } finally { setThreadReplySending(false); }
  };

  const enrByCourse = (courseId: number) => enrollments.filter(e => e.course_id === courseId);

  const chartData = courses.map(c => {
    const ces = enrByCourse(c.course_id);
    return {
      name: c.title.length > 14 ? c.title.slice(0, 14) + '…' : c.title,
      ongoing: ces.filter(e => e.completion_status === 'Ongoing').length,
      completed: ces.filter(e => e.completion_status === 'Completed').length,
      dropped: ces.filter(e => e.completion_status === 'Dropped').length,
    };
  });

  const endingCourses = courses.filter(c => {
    if (!c.end_date || c.status !== 'Active') return false;
    const daysLeft = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
    return daysLeft >= 0 && daysLeft <= 14;
  });

  if (loading || !user) return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <div className="sk" style={{ height: 28, width: 200, borderRadius: 8 }} />
        <div className="sk" style={{ height: 14, width: 280, borderRadius: 6, marginTop: 10 }} />
      </div>
      <SkeletonKPIs count={4} /><SkeletonCard lines={4} />
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">{t('nav.dashboard')}</h1>
        <p className="page-sub">{t('dash.welcome', { name: user?.first_name || '' })}</p>
      </div>

      {dataLoading ? (
        <><SkeletonKPIs count={4} /><SkeletonCard lines={4} /></>
      ) : (
        <>
          {/* End-of-course alerts */}
          {endingCourses.map(c => {
            const daysLeft = Math.ceil((new Date(c.end_date!).getTime() - Date.now()) / 86400000);
            const urgentColor = daysLeft <= 5 ? '#F87171' : '#F59E0B';
            const remaining = curriculumStats[c.course_id]?.sessions_without_records ?? 0;
            return (
              <div key={c.course_id} style={{ background: `${urgentColor}10`, border: `1px solid ${urgentColor}40`, borderRadius: 12, padding: '14px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: `${urgentColor}20`, borderRadius: 8, padding: 8, flexShrink: 0 }}>{I(PATHS.bell, 16, urgentColor)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: urgentColor, fontSize: 13, fontWeight: 700, margin: 0 }}>{c.title} — {t('dash.course_ending_soon')}</p>
                  <p style={{ color: 'var(--fg-2)', fontSize: 12, margin: 0, marginTop: 2 }}>
                    {t('dash.course_ending_body', { n: String(daysLeft) })}
                    {remaining > 0 && <span style={{ color: urgentColor, fontWeight: 600 }}> · {remaining} {t('dash.sessions_unit')} {t('common.none').toLowerCase()}</span>}
                  </p>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: urgentColor, flexShrink: 0, fontFamily: "'Syne', sans-serif" }}>{daysLeft}d</span>
              </div>
            );
          })}

          {/* KPIs */}
          <div className="kpi-grid-4" style={{ marginBottom: 20 }}>
            <KPI label={t('dash.my_courses')} value={stats?.my_courses ?? '—'} accent="#0EA5E9" icon={PATHS.courses} />
            <KPI label={t('dash.my_students')} value={stats?.my_students ?? '—'} accent="#10B981" icon={PATHS.students} />
            <KPI label={t('dash.total_enrollments')} value={stats?.total_enrollments ?? '—'} accent="#8B5CF6" icon={PATHS.enrollments} />
            <KPI label={t('dash.completion_rate')} value={stats ? `${stats.completion_rate}%` : '—'} sub={t('dash.completion_my')} accent="#F59E0B" icon={PATHS.check} />
          </div>

          {/* Quick action */}
          <div style={{ marginBottom: 20 }}>
            <Link href="/dashboard/teacher/students" style={{ textDecoration: 'none' }}>
              <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#10B981'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}>
                <div style={{ background: '#10B98115', borderRadius: 8, padding: 8 }}>{I(PATHS.students, 16, '#10B981')}</div>
                <span className="text-fg" style={{ fontSize: 14, fontWeight: 500 }}>{t('nav.my_students')}</span>
                <span className="text-fg3" style={{ marginLeft: 'auto' }}>→</span>
              </div>
            </Link>
          </div>

          {/* Session dot-tracker */}
          {courses.filter(c => (curriculumStats[c.course_id]?.total_sessions ?? 0) > 0).length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('dash.sessions_progress')}</h2>
              <p className="text-fg2" style={{ fontSize: 13, marginBottom: 20 }}>{t('dash.sessions_unit')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {courses.map(c => {
                  const cStats = curriculumStats[c.course_id];
                  const conducted = cStats?.sessions_with_records ?? 0;
                  const planned = cStats?.total_sessions ?? 0;
                  if (planned === 0) return null;
                  const pct = Math.round((conducted / planned) * 100);
                  const pctColor = pct >= 75 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#0EA5E9';
                  const ces = enrByCourse(c.course_id);
                  const completionRate = ces.length > 0 ? Math.round((ces.filter(e => e.completion_status === 'Completed').length / ces.length) * 100) : 0;
                  const crColor = completionRate >= 75 ? '#10B981' : completionRate >= 40 ? '#F59E0B' : '#F87171';
                  const maxDots = Math.min(planned, 24);
                  const dots = Array.from({ length: maxDots }, (_, i) => i < conducted);
                  const daysLeft = c.end_date ? Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000) : null;
                  const isEndingSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && c.status === 'Active';

                  return (
                    <div key={c.course_id} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <p className="text-fg" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{c.title}</p>
                          <p className="text-fg3" style={{ fontSize: 11, margin: 0, marginTop: 2 }}>
                            {t(`course.type_${c.course_type || 'onsite'}`)} · {t(`course.status_${c.status.toLowerCase()}`)}
                            {isEndingSoon && <span style={{ color: daysLeft! <= 5 ? '#F87171' : '#F59E0B', fontWeight: 700 }}> · {t('dash.days_left', { n: String(daysLeft) })}</span>}
                          </p>
                        </div>
                        <div style={{ textAlign: 'center', background: `${pctColor}12`, border: `1px solid ${pctColor}30`, borderRadius: 12, padding: '8px 16px', flexShrink: 0 }}>
                          <p style={{ color: 'var(--fg-3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, marginBottom: 2 }}>{t('dash.week_label', { n: '' }).replace('{n}', '').trim()}</p>
                          <p style={{ color: pctColor, fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{conducted}</p>
                          <p style={{ color: 'var(--fg-3)', fontSize: 10, margin: 0, marginTop: 2 }}>/ {planned} {t('dash.sessions_unit')}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                        {dots.map((done, i) => (
                          <div key={i} title={`${t('att.session_label')} ${i + 1}`}
                            style={{ width: 14, height: 14, borderRadius: 3, background: done ? pctColor : 'var(--border-soft)', border: `1px solid ${done ? pctColor + '60' : 'var(--border)'}`, transition: 'background 0.3s' }} />
                        ))}
                        {planned > maxDots && <span style={{ fontSize: 11, color: 'var(--fg-3)', alignSelf: 'center', marginInlineStart: 4 }}>+{planned - maxDots}</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {[{ label: t('dash.sessions_progress'), pct, color: pctColor }, { label: t('dash.completion_rate'), pct: completionRate, color: crColor }].map(({ label, pct: p, color }) => (
                          <div key={label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span className="text-fg3" style={{ fontSize: 11 }}>{label}</span>
                              <span style={{ color, fontSize: 11, fontWeight: 700 }}>{p}%</span>
                            </div>
                            <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                              <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Enrollment chart */}
          <EnrollmentBarChart
            data={chartData}
            isRtl={isRtl}
            title={t('dash.enroll_breakdown')}
            labels={{ ongoing: t('enr.status_ongoing'), completed: t('enr.status_completed'), dropped: t('enr.status_dropped') }}
          />

          {/* My Courses accordion */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700 }}>{t('dash.my_courses')}</h2>
              <Link href="/dashboard/teacher/students" style={{ color: '#0EA5E9', fontSize: 13, textDecoration: 'none' }}>{t('dash.view_students')} →</Link>
            </div>
            {courses.length === 0 ? (
              <p className="text-fg3" style={{ fontSize: 14, padding: '20px 0' }}>{t('dash.no_courses_assigned')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {courses.map(c => (
                  <CourseCard
                    key={c.course_id}
                    course={c}
                    enrollments={enrByCourse(c.course_id)}
                    curriculumStats={curriculumStats[c.course_id]}
                    lastSession={lastSessions[c.course_id]}
                    attendanceTrend={attendanceTrends[c.course_id]}
                    notes={notes[c.course_id]}
                    isExpanded={expandedCourseId === c.course_id}
                    expandLoading={expandLoading === c.course_id}
                    noteText={noteText[c.course_id] || ''}
                    noteSending={noteSending === c.course_id}
                    noteSent={noteSent === c.course_id}
                    onToggle={() => handleExpandCourse(c.course_id)}
                    onNoteChange={text => setNoteText(prev => ({ ...prev, [c.course_id]: text }))}
                    onNoteSend={() => handleSendNote(c.course_id)}
                    onOpenThread={note => { setThreadNote({ ...note, course_id: c.course_id }); setThreadReply(''); }}
                    fmtTime={fmtTime}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Thread modal */}
      {threadNote && (
        <ThreadModal
          note={threadNote}
          reply={threadReply}
          sending={threadReplySending}
          onClose={() => { setThreadNote(null); setThreadReply(''); }}
          onReplyChange={setThreadReply}
          onSend={sendThreadReply}
          fmtTime={fmtTime}
          t={t}
        />
      )}
    </DashboardLayout>
  );
}
