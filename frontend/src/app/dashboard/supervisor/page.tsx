'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsApi, usersApi, notesApi, curriculumApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonKPIs, SkeletonCard } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import EnrollmentBarChart from '@/components/EnrollmentBarChart';
import NoteThreadModal, { parseReport, type TeacherNote, type RosterEntry } from '@/components/supervisor/NoteThreadModal';

interface Summary {
  total_students: number; total_courses: number; active_courses: number;
  total_enrollments: number; completion_rate: number;
  total_completed: number; total_ongoing: number; total_dropped: number;
  avg_grade: number | null; total_teachers: number;
}
interface CourseBreakdown { course_id: number; title: string; status: string; teacher_name: string; total: number; ongoing: number; completed: number; dropped: number; completion_rate: number; avg_grade: number | null; }
interface StaffUser { user_id: number; first_name: string; last_name: string; role: string; }
interface AbsentStudent {
  student_id: number; name: string; student_number: string;
  phone_number: string | null; course_title: string; course_id: number; session_date: string;
}

const I = (d: string, s = 18, c = 'currentColor') => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const PATHS = {
  students: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  courses: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  enrollments: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  import: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  teachers: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
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

const QuickAction = ({ label, href, icon, color }: { label: string; href: string; icon: string; color: string }) => (
  <Link href={href} style={{ textDecoration: 'none' }}>
    <div className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}>
      <div style={{ background: `${color}15`, borderRadius: 8, padding: 8, flexShrink: 0 }}>{I(icon, 16, color)}</div>
      <span className="text-fg" style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <span className="text-fg3" style={{ marginLeft: 'auto' }}>→</span>
    </div>
  </Link>
);

const PIE_COLORS = ['#10B981', '#0EA5E9', '#F87171'];

export default function SupervisorDashboard() {
  const { user, loading } = useRequireRole('supervisor');
  const { t, dir } = useT();
  const isRtl = dir === 'rtl';
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [courseBreakdown, setCourseBreakdown] = useState<CourseBreakdown[]>([]);
  const [teachers, setTeachers] = useState<StaffUser[]>([]);
  const [absentYesterday, setAbsentYesterday] = useState<AbsentStudent[]>([]);
  const [absentOpen, setAbsentOpen] = useState(true);
  const [recentNotes, setRecentNotes] = useState<TeacherNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<TeacherNote | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const NOTES_PREVIEW = 3;
  const [sessionRoster, setSessionRoster] = useState<RosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'supervisor') {
      Promise.all([
        analyticsApi.summary().then(res => setSummary(res.data)).catch(() => {}),
        analyticsApi.courses().then(res => setCourseBreakdown(res.data)).catch(() => {}),
        usersApi.list().then(res => setTeachers(res.data.filter((u: StaffUser) => u.role === 'teacher'))).catch(() => {}),
        analyticsApi.absentYesterday().then(res => setAbsentYesterday(res.data)).catch(() => {}),
        notesApi.recent(15).then(res => setRecentNotes(res.data)).catch(() => {}),
      ]).finally(() => setDataLoading(false));
    }
  }, [user]);

  const fmtTime = (iso: string | null) => {
    if (!iso) return '—';
    return `${iso.slice(0, 10)} · ${iso.slice(11, 16)}`;
  };

  // Fetch the attendance roster whenever a session-report note is opened
  useEffect(() => {
    if (!selectedNote || !selectedNote.curriculum_session_id) {
      setSessionRoster([]);
      return;
    }
    const parsed = parseReport(selectedNote.content);
    if (!parsed.isReport) { setSessionRoster([]); return; }
    setRosterLoading(true);
    curriculumApi
      .getAttendance(selectedNote.course_id, selectedNote.curriculum_session_id)
      .then(res => setSessionRoster(res.data.roster ?? []))
      .catch(() => setSessionRoster([]))
      .finally(() => setRosterLoading(false));
  }, [selectedNote]);

  const sendReply = async () => {
    if (!selectedNote || !replyContent.trim()) return;
    setReplySending(true);
    try {
      const res = await notesApi.reply(selectedNote.id, replyContent.trim());
      setSelectedNote(prev => prev ? { ...prev, replies: [...prev.replies, res.data] } : prev);
      setRecentNotes(prev => prev.map(n => n.id === selectedNote.id ? { ...n, replies: [...n.replies, res.data] } : n));
      setReplyContent('');
    } catch { } finally { setReplySending(false); }
  };

  const deleteNote = async () => {
    if (!selectedNote) return;
    if (!window.confirm(t('common.sure'))) return;
    try {
      await notesApi.delete(selectedNote.course_id, selectedNote.id);
      setRecentNotes(prev => prev.filter(n => n.id !== selectedNote.id));
      setSelectedNote(null);
      setReplyContent('');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? t('common.error');
      alert(msg);
    }
  };

  const pieData = summary && summary.total_enrollments > 0 ? [
    { name: t('enr.status_completed'), value: summary.total_completed ?? 0 },
    { name: t('enr.status_ongoing'), value: summary.total_ongoing ?? 0 },
    { name: t('enr.status_dropped'), value: summary.total_dropped ?? 0 },
  ].filter(d => d.value > 0) : [];

  const courseBarData = courseBreakdown.slice(0, 8).map(c => ({
    name: c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title,
    ongoing: c.ongoing, completed: c.completed, dropped: c.dropped,
  }));

  if (loading || !user) return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <div className="sk" style={{ height: 28, width: 200, borderRadius: 8 }} />
        <div className="sk" style={{ height: 14, width: 280, borderRadius: 6, marginTop: 10 }} />
      </div>
      <SkeletonKPIs count={4} /><SkeletonKPIs count={2} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SkeletonCard lines={4} /><SkeletonCard lines={4} />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">{t('nav.dashboard')}</h1>
        <p className="page-sub">{t('dash.welcome', { name: user?.first_name || '' })}</p>
      </div>

      {dataLoading ? (
        <>
          <SkeletonKPIs count={4} /><SkeletonKPIs count={2} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SkeletonCard lines={4} /><SkeletonCard lines={4} />
          </div>
        </>
      ) : (
        <>
          <div className="kpi-grid-4">
            <KPI label={t('nav.students')} value={summary?.total_students ?? '—'} accent="#10B981" icon={PATHS.students} />
            <KPI label={t('nav.courses')} value={summary?.total_courses ?? '—'} sub={summary ? t('dash.active_courses', { n: summary.active_courses }) : ''} accent="#0EA5E9" icon={PATHS.courses} />
            <KPI label={t('dash.teachers')} value={summary?.total_teachers ?? '—'} accent="#F59E0B" icon={PATHS.teachers} />
            <KPI label={t('nav.enrollments')} value={summary?.total_enrollments ?? '—'} accent="#8B5CF6" icon={PATHS.enrollments} />
          </div>
          <div className="kpi-grid-2">
            <KPI label={t('dash.completion_rate')} value={summary ? `${summary.completion_rate}%` : '—'} sub={t('dash.completion_sub')} accent="#10B981" icon={PATHS.check} />
            <KPI label={t('dash.avg_grade')} value={summary?.avg_grade != null ? summary.avg_grade : '—'} sub={t('dash.avg_grade_sub')} accent="#0EA5E9" icon={PATHS.chart} />
          </div>

          {/* Quick actions */}
          <div style={{ marginBottom: 20 }}>
            <p className="label-xs" style={{ marginBottom: 12 }}>{t('common.actions')}</p>
            <div className="grid-4">
              <QuickAction label={t('nav.import')} href="/dashboard/supervisor/import" icon={PATHS.import} color="#F59E0B" />
              <QuickAction label={t('nav.students')} href="/dashboard/supervisor/students" icon={PATHS.students} color="#10B981" />
              <QuickAction label={t('nav.enrollments')} href="/dashboard/supervisor/enrollments" icon={PATHS.enrollments} color="#8B5CF6" />
              <QuickAction label={t('nav.courses')} href="/dashboard/supervisor/courses" icon={PATHS.courses} color="#0EA5E9" />
            </div>
          </div>

          {/* 24h absence alert */}
          {absentYesterday.length > 0 && (
            <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <button onClick={() => setAbsentOpen(o => !o)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: 'rgba(248,113,113,0.12)', borderRadius: 8, padding: 7 }}>{I(PATHS.students, 16, '#F87171')}</div>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: '#F87171', fontSize: 14, fontWeight: 700, margin: 0 }}>{t('dash.absent_yesterday_title', { n: String(absentYesterday.length) })}</p>
                    <p style={{ color: '#DC2626', fontSize: 13, margin: 0 }}>{t('dash.absent_yesterday_sub')}</p>
                  </div>
                </div>
                <span style={{ color: '#DC2626', fontSize: 13 }}>{absentOpen ? '▴' : '▾'}</span>
              </button>
              {absentOpen && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {absentYesterday.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                      <div>
                        <span style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                        <span style={{ color: 'var(--fg-3)', fontSize: 12, marginInlineStart: 8, fontFamily: 'monospace' }}>{s.student_number}</span>
                        <p style={{ color: 'var(--fg-2)', fontSize: 12, margin: '2px 0 0' }}>{s.course_title}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginInlineStart: 12 }}>
                        {s.phone_number
                          ? <a href={`tel:${s.phone_number}`} style={{ color: '#10B981', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>📞 {s.phone_number}</a>
                          : <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>—</span>}
                        <p style={{ color: '#F87171', fontSize: 11, fontWeight: 600, margin: '2px 0 0' }}>{t('dash.absent')} · {s.session_date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Courses + Enrollment chart */}
          <div className="grid-2">
            {/* Supervised courses list */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700 }}>{t('dash.supervised')}</h2>
                <Link href="/dashboard/supervisor/courses" style={{ color: '#0EA5E9', fontSize: 13, textDecoration: 'none' }}>{t('common.view')} →</Link>
              </div>
              {courseBreakdown.length === 0
                ? <p className="text-fg3" style={{ fontSize: 14 }}>{t('course.none')}</p>
                : courseBreakdown.slice(0, 6).map(c => {
                  const rateColor = c.completion_rate >= 75 ? '#10B981' : c.completion_rate >= 40 ? '#F59E0B' : '#F87171';
                  return (
                    <div key={c.course_id} className="row-divide" style={{ padding: '12px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div>
                          <p className="text-fg" style={{ fontSize: 14, fontWeight: 500 }}>{c.title}</p>
                          <p className="text-fg2" style={{ fontSize: 13, marginTop: 2 }}>{t('course.teacher')}: {c.teacher_name}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <p style={{ color: rateColor, fontSize: 15, fontWeight: 700, margin: 0 }}>{c.completion_rate}%</p>
                          <p className="text-fg3" style={{ fontSize: 11, margin: 0 }}>{c.completed}/{c.total}</p>
                        </div>
                      </div>
                      <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${c.completion_rate}%`, height: '100%', background: rateColor, borderRadius: 99, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Enrollment status breakdown */}
            <div className="card">
              <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('dash.enroll_status')}</h2>
              <p className="text-fg2" style={{ fontSize: 13, marginBottom: 16 }}>{t('dash.enroll_dist_sub')}</p>
              {summary && pieData.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, '']} contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {pieData.map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i], flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <p className="text-fg" style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{d.value}</p>
                          <p className="text-fg2" style={{ fontSize: 11, margin: 0 }}>{d.name}</p>
                        </div>
                        <span className="text-fg3" style={{ fontSize: 13 }}>
                          {summary.total_enrollments > 0 ? Math.round((d.value / summary.total_enrollments) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                    <div className="border-top" style={{ paddingTop: 10, marginTop: 4 }}>
                      <p className="text-fg2" style={{ fontSize: 13 }}>{t('dash.enroll_total')}: <strong className="text-fg">{summary.total_enrollments}</strong></p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-fg3" style={{ fontSize: 13 }}>{t('dash.enroll_chart_empty')}</p>
              )}

              {/* Mini per-course stacked bar */}
              {courseBarData.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p className="label-xs" style={{ marginBottom: 10 }}>{t('dash.course_status_label')}</p>
                  <EnrollmentBarChart
                    data={courseBarData}
                    isRtl={isRtl}
                    labels={{ ongoing: t('enr.status_ongoing'), completed: t('enr.status_completed'), dropped: t('enr.status_dropped') }}
                    asCard={false}
                    maxBarSize={22}
                    rowHeight={36}
                    minHeight={28}
                    showLegend={false}
                    tickFontSize={10}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Teacher notes feed */}
          {recentNotes.length > 0 && (
            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ background: '#0EA5E915', borderRadius: 8, padding: 7, flexShrink: 0 }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{t('dash.note_to_supervisor')}</h2>
                  <p className="text-fg2" style={{ fontSize: 13, margin: 0 }}>{t('dash.past_notes')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(showAllNotes ? recentNotes : recentNotes.slice(0, NOTES_PREVIEW)).map(n => {
                  const parsed = parseReport(n.content);
                  return (
                    <div key={n.id} onClick={() => setSelectedNote(n)}
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '14px 16px', borderInlineStart: `4px solid ${parsed.isReport ? '#8B5CF6' : '#0EA5E9'}40`, cursor: 'pointer', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = parsed.isReport ? '#8B5CF680' : '#0EA5E980')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-soft)')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#0EA5E915', color: '#0EA5E9', border: '1px solid #0EA5E940', whiteSpace: 'nowrap' }}>{n.course_title}</span>
                          {parsed.isReport && (
                            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#8B5CF615', color: '#8B5CF6', border: '1px solid #8B5CF640', whiteSpace: 'nowrap' }}>📋 {t('att.session_report')}</span>
                          )}
                        </div>
                        <span className="text-fg3" style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>{n.author_name} · {fmtTime(n.created_at)}</span>
                      </div>
                      {parsed.isReport ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p className="text-fg" style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{parsed.sessionTitle}</p>
                            <p className="text-fg3" style={{ fontSize: 12, margin: '3px 0 0' }}>{parsed.weekInfo}</p>
                          </div>
                          {parsed.present !== null && parsed.total !== null && (
                            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                              <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>✓ {parsed.present}/{parsed.total}</span>
                              {parsed.absent !== null && parsed.absent > 0 && <span style={{ fontSize: 12, color: '#F87171', fontWeight: 700 }}>✗ {parsed.absent}</span>}
                            </div>
                          )}
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: '#8B5CF615', color: '#8B5CF6', border: '1px solid #8B5CF630', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {t('common.view')} →
                          </span>
                        </div>
                      ) : (
                        <p className="text-fg" style={{ fontSize: 13, lineHeight: 1.6, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{n.content}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {recentNotes.length > NOTES_PREVIEW && (
                <button
                  onClick={() => setShowAllNotes(v => !v)}
                  style={{ marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface-2)', color: 'var(--fg2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-3)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)')}
                >
                  {showAllNotes
                    ? t('common.show_less')
                    : `${t('common.show_more')} (${recentNotes.length - NOTES_PREVIEW})`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Note Thread Modal */}
      {selectedNote && (
        <NoteThreadModal
          note={selectedNote}
          roster={sessionRoster}
          rosterLoading={rosterLoading}
          replyContent={replyContent}
          replySending={replySending}
          onClose={() => { setSelectedNote(null); setReplyContent(''); }}
          onDelete={deleteNote}
          onReplyChange={setReplyContent}
          onSend={sendReply}
          fmtTime={fmtTime}
          t={t}
        />
      )}
    </DashboardLayout>
  );
}
