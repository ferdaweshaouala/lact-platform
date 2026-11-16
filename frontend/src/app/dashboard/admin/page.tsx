'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsApi, coursesApi, exportApi, curriculumApi, attendanceApi, usersApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonKPIs } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';

interface Summary {
  total_students: number; total_courses: number; active_courses: number;
  total_enrollments: number; completion_rate: number;
  total_completed: number; total_ongoing: number; total_dropped: number;
  avg_grade: number | null; total_teachers: number;
}

interface CourseBreakdown {
  course_id: number; title: string; status: string;
  course_type: string; total_sessions: number | null;
  teacher_name: string; supervisor_name: string;
  total: number; ongoing: number; completed: number; dropped: number;
  completion_rate: number; avg_grade: number | null;
}

interface TeacherStat {
  teacher_id: number; name: string; email: string;
  courses: number; students: number; completed: number; completion_rate: number;
}

interface CompletedStudent {
  enrollment_id: number;
  student_name: string;
  student_number: string;
  course_title: string;
  enrollment_date: string | null;
  avg_grade: number | null;
}

const I = (d: string, s = 18, c = 'currentColor') => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const PATHS = {
  students: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  courses: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  teachers: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  enrollments: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  report: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  export: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
};

const KPI = ({ label, value, sub, accent, icon }: { label: string; value: string | number; sub?: string; accent: string; icon: string }) => (
  <div className="card" style={{ borderInlineStart: `4px solid ${accent}`, padding: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
      <p className="label-xs">{label}</p>
      <div style={{ background: `${accent}15`, borderRadius: 8, padding: 7, flexShrink: 0 }}>
        {I(icon, 15, accent)}
      </div>
    </div>
    <p style={{ color: accent, fontSize: 32, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>{value}</p>
    {sub && <p className="text-fg3" style={{ fontSize: 13, marginTop: 4 }}>{sub}</p>}
  </div>
);

const QuickAction = ({ label, href, icon, color }: { label: string; href: string; icon: string; color: string }) => (
  <Link href={href} style={{ textDecoration: 'none' }}>
    <div
      className="card-sm"
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
    >
      <div style={{ background: `${color}15`, borderRadius: 8, padding: 8, flexShrink: 0 }}>{I(icon, 16, color)}</div>
      <span className="text-fg" style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <span style={{ marginLeft: 'auto' }} className="text-fg3">→</span>
    </div>
  </Link>
);

const statusColors: Record<string, string> = { Active: '#10B981', Inactive: '#64748B' };
const PIE_COLORS = ['#10B981', '#0EA5E9', '#F87171'];

export default function AdminDashboard() {
  const { user, loading } = useRequireRole('admin');
  const { t, lang } = useT();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<{ course_id: number; title: string }[]>([]);
  const [courseBreakdown, setCourseBreakdown] = useState<CourseBreakdown[]>([]);
  const [curriculumStats, setCurriculumStats] = useState<Record<number, { total_sessions: number; sessions_with_records: number }>>({});
  const [teachers, setTeachers] = useState<TeacherStat[]>([]);
  const [expandedTeacherId, setExpandedTeacherId] = useState<number | null>(null);
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [attendanceTrends, setAttendanceTrends] = useState<Record<number, { date: string; present: number; absent: number; makeup: number }[]>>({});
  const [attendanceLoading, setAttendanceLoading] = useState<number | null>(null);

  const handleExpandCourse = (courseId: number) => {
    if (expandedCourseId === courseId) { setExpandedCourseId(null); return; }
    setExpandedCourseId(courseId);
    if (attendanceTrends[courseId]) return; // already fetched
    setAttendanceLoading(courseId);
    attendanceApi.trend(courseId)
      .then(r => {
        const rows = (r.data ?? []).map((row: { session_date: string; present: number; absent: number; makeup: number }) => ({
          date: row.session_date,
          present: row.present,
          absent: row.absent,
          makeup: row.makeup,
        }));
        setAttendanceTrends(prev => ({ ...prev, [courseId]: rows }));
      })
      .catch(() => setAttendanceTrends(prev => ({ ...prev, [courseId]: [] })))
      .finally(() => setAttendanceLoading(null));
  };
  const [completedStudents, setCompletedStudents] = useState<CompletedStudent[]>([]);
  const [exportCourse, setExportCourse] = useState('');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    const fetchAll = () => Promise.all([
      analyticsApi.summary().then(res => setSummary(res.data)),
      coursesApi.list().then(res => setCourses(res.data)),
      analyticsApi.courses().then(async res => {
        const breakdown: CourseBreakdown[] = res.data;
        setCourseBreakdown(breakdown);
        // Fetch curriculum stats per course in parallel
        const statsMap: Record<number, { total_sessions: number; sessions_with_records: number }> = {};
        await Promise.all(breakdown.map(c =>
          curriculumApi.stats(c.course_id)
            .then(r => { statsMap[c.course_id] = r.data; })
            .catch(() => {})
        ));
        setCurriculumStats(statsMap);
      }).catch(() => {}),
      analyticsApi.teachers().then(res => setTeachers(res.data)).catch(() => {}),
      analyticsApi.report({ status: 'Completed', limit: 100 }).then(res => setCompletedStudents(res.data.items ?? res.data)).catch(() => {}),
    ]).catch(() => setError(t('common.error'))).finally(() => setDataLoading(false));

    fetchAll();

    // Refetch when the tab regains focus so changes made in other tabs/sessions
    // (e.g. a supervisor deleting a course) show up without a manual refresh.
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', fetchAll);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', fetchAll);
    };
  }, [user]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportApi.enrollments({
        course_id: exportCourse ? parseInt(exportCourse) : undefined,
        date_from: exportFrom || undefined,
        date_to: exportTo || undefined,
        lang,
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'enrollments_export.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { setError(t('reports.error_export')); } finally { setExporting(false); }
  };

  if (loading || !user) return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <div className="sk" style={{ height: 28, width: 200, borderRadius: 8 }} />
        <div className="sk" style={{ height: 14, width: 280, borderRadius: 6, marginTop: 10 }} />
      </div>
      <SkeletonKPIs count={4} /><SkeletonKPIs count={2} />
    </DashboardLayout>
  );

  const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', background: 'var(--input-bg)', color: 'var(--fg)' };

  const pieData = summary && summary.total_enrollments > 0 ? [
    { name: t('enr.status_completed'), value: summary.total_completed ?? 0 },
    { name: t('enr.status_ongoing'), value: summary.total_ongoing ?? 0 },
    { name: t('enr.status_dropped'), value: summary.total_dropped ?? 0 },
  ].filter(d => d.value > 0) : [];

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">{t('nav.dashboard')}</h1>
        <p className="page-sub">{t('dash.welcome', { name: user?.first_name || '' })}</p>
      </div>

      {error && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '12px 16px', color: '#F87171', fontSize: 13, marginBottom: 24 }}>{error}</div>}

      {dataLoading ? (
        <><SkeletonKPIs count={4} /><SkeletonKPIs count={2} /></>
      ) : (
        <>
          {summary && (
            <>
              <div className="kpi-grid-4">
                <KPI label={t('dash.total_students')} value={summary.total_students} accent="#10B981" icon={PATHS.students} />
                <KPI label={t('dash.total_courses')} value={summary.total_courses} sub={t('dash.active_courses', { n: summary.active_courses })} accent="#0EA5E9" icon={PATHS.courses} />
                <KPI label={t('dash.total_enrollments')} value={summary.total_enrollments} accent="#8B5CF6" icon={PATHS.enrollments} />
                <KPI label={t('dash.teachers')} value={summary.total_teachers} accent="#F59E0B" icon={PATHS.teachers} />
              </div>
              <div className="kpi-grid-2">
                <KPI label={t('dash.completion_rate')} value={`${summary.completion_rate}%`} sub={t('dash.completion_sub')} accent="#10B981" icon={PATHS.check} />
                <KPI label={t('dash.avg_grade')} value={summary.avg_grade != null ? summary.avg_grade : '—'} sub={t('dash.avg_grade_sub')} accent="#0EA5E9" icon={PATHS.chart} />
              </div>

              {/* Enrollment breakdown: bar + pie side by side */}
              <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, padding: '20px 24px', marginBottom: 20, alignItems: 'center' }}>
                <div>
                  <p className="label-xs" style={{ marginBottom: 14 }}>{t('dash.enroll_status')}</p>
                  {[
                    { label: t('enr.status_completed'), count: summary.total_completed ?? 0, color: '#10B981' },
                    { label: t('enr.status_ongoing'), count: summary.total_ongoing ?? 0, color: '#0EA5E9' },
                    { label: t('enr.status_dropped'), count: summary.total_dropped ?? 0, color: '#F87171' },
                  ].map(item => (
                    <div key={item.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                          <span style={{ color: 'var(--fg-2)', fontSize: 13 }}>{item.label}</span>
                        </div>
                        <span style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 700 }}>{item.count}</span>
                      </div>
                      <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: summary.total_enrollments ? `${(item.count / summary.total_enrollments) * 100}%` : '0%', height: '100%', background: item.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
                {pieData.length > 0 && (
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [v, '']} contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}

          {/* Quick actions */}
          <div style={{ marginBottom: 20 }}>
            <p className="label-xs" style={{ marginBottom: 12 }}>{t('common.actions')}</p>
            <div className="grid-3">
              <QuickAction label={t('nav.users')} href="/dashboard/admin/users" icon={PATHS.users} color="#10B981" />
              <QuickAction label={t('nav.analytics')} href="/dashboard/admin/analytics" icon={PATHS.chart} color="#0EA5E9" />
              <QuickAction label={t('nav.reports')} href="/dashboard/admin/reports" icon={PATHS.report} color="#8B5CF6" />
            </div>
          </div>

          {/* Course analysis — clickable cards with progress bars */}
          {courseBreakdown.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700 }}>{t('dash.courses_analysis')}</h2>
                  <p className="text-fg2" style={{ fontSize: 13, marginTop: 2 }}>{t('dash.courses_analysis_sub', { n: courseBreakdown.length })}</p>
                </div>
                <Link href="/dashboard/admin/analytics" style={{ color: '#0EA5E9', fontSize: 13, textDecoration: 'none' }}>{t('dash.full_analytics')} →</Link>
              </div>
              {/* Accordion list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {courseBreakdown.map((c, idx) => {
                  const rateColor = c.completion_rate >= 75 ? '#10B981' : c.completion_rate >= 40 ? '#F59E0B' : '#F87171';
                  const isOnline = c.course_type === 'online';
                  const cStats = curriculumStats[c.course_id];
                  const conducted = cStats?.sessions_with_records ?? 0;
                  const planned = cStats?.total_sessions ?? 0;
                  const sessionPct = planned > 0 ? Math.round((conducted / planned) * 100) : 0;
                  const isExpanded = expandedCourseId === c.course_id;
                  return (
                    <div key={c.course_id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: isExpanded ? 'var(--surface-2)' : 'transparent', transition: 'background 0.2s' }}>

                      {/* ── Compact row (always visible) ── */}
                      <div
                        onClick={() => handleExpandCourse(c.course_id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                          cursor: 'pointer', userSelect: 'none',
                          borderBottom: isExpanded ? '1px solid var(--border-soft)' : 'none',
                        }}
                        onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
                        onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        {/* Index + color dot */}
                        <span style={{ color: 'var(--fg-3)', fontSize: 12, fontFamily: 'monospace', flexShrink: 0, minWidth: 20, textAlign: 'center' }}>{idx + 1}</span>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: rateColor, flexShrink: 0 }} />

                        {/* Course title + teacher */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="text-fg" style={{ fontSize: 14, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                          <p className="text-fg3" style={{ fontSize: 11, margin: 0, marginTop: 1 }}>
                            {c.teacher_name !== 'Unassigned' ? c.teacher_name : <span style={{ color: '#F59E0B' }}>{t('course.unassigned')}</span>}
                          </p>
                        </div>

                        {/* Badges + mini stats */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                            background: isOnline ? '#8B5CF618' : '#F59E0B18',
                            color: isOnline ? '#8B5CF6' : '#F59E0B',
                            border: `1px solid ${isOnline ? '#8B5CF640' : '#F59E0B40'}` }}>
                            {t(`course.type_${c.course_type || 'onsite'}`)}
                          </span>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                            background: `${statusColors[c.status]}18`, color: statusColors[c.status],
                            border: `1px solid ${statusColors[c.status]}40` }}>
                            {c.status === 'Active' ? t('course.status_active') : t('course.status_inactive')}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: rateColor, minWidth: 38, textAlign: 'end' }}>{c.completion_rate}%</span>
                          {conducted > 0 && (
                            <span style={{ fontSize: 11, color: '#0EA5E9', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {conducted}/{planned}
                            </span>
                          )}
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>

                      {/* ── Expanded detail panel ── */}
                      {isExpanded && (
                        <div style={{ padding: '16px 20px' }}>

                          {/* Session progress bar — only show when sessions have actually started */}
                          {conducted > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span className="text-fg2" style={{ fontSize: 12 }}>{t('dash.sessions_progress')}</span>
                                <span style={{ color: '#0EA5E9', fontSize: 12, fontWeight: 700 }}>
                                  {conducted} / {planned} {t('dash.sessions_unit')} · {sessionPct}%
                                </span>
                              </div>
                              <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                                <div style={{ width: `${sessionPct}%`, height: '100%', background: '#0EA5E9', borderRadius: 99, transition: 'width 0.6s ease' }} />
                              </div>
                            </div>
                          )}

                          {/* Completion bar */}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span className="text-fg2" style={{ fontSize: 12 }}>{t('dash.completion_rate')}</span>
                              <span style={{ color: rateColor, fontSize: 12, fontWeight: 700 }}>{c.completion_rate}%</span>
                            </div>
                            <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                              <div style={{ width: `${c.completion_rate}%`, height: '100%', background: rateColor, borderRadius: 99, transition: 'width 0.6s ease' }} />
                            </div>
                          </div>

                          {/* Enrollment stats grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                            {[
                              { val: c.ongoing,   label: t('enr.status_ongoing'),   color: '#0EA5E9' },
                              { val: c.completed, label: t('enr.status_completed'), color: '#10B981' },
                              { val: c.dropped,   label: t('enr.status_dropped'),   color: '#F87171' },
                              { val: c.total,     label: t('dash.col_enrolled'),    color: 'var(--fg)' },
                            ].map(({ val, label, color }) => (
                              <div key={label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 6px', textAlign: 'center', border: '1px solid var(--border-soft)' }}>
                                <p style={{ color, fontSize: 20, fontWeight: 800, margin: 0, fontFamily: "'Syne', sans-serif" }}>{val}</p>
                                <p className="text-fg3" style={{ fontSize: 10, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{label}</p>
                              </div>
                            ))}
                          </div>

                          {/* Attendance chart */}
                          <div style={{ marginTop: 4 }}>
                            <p className="text-fg2" style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t('att.open')}</p>
                            {attendanceLoading === c.course_id ? (
                              <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div className="sk" style={{ width: '100%', height: 100, borderRadius: 8 }} />
                              </div>
                            ) : !attendanceTrends[c.course_id] || attendanceTrends[c.course_id].length === 0 ? (
                              <p className="text-fg3" style={{ fontSize: 12, padding: '16px 0' }}>{t('att.no_records')}</p>
                            ) : (
                              <div dir="ltr">
                                <ResponsiveContainer width="100%" height={160}>
                                  <BarChart data={attendanceTrends[c.course_id]} margin={{ top: 4, right: 8, left: -20, bottom: 4 }} barSize={14}>
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--fg-3)' }} tickFormatter={d => d.slice(5)} />
                                    <YAxis tick={{ fontSize: 10, fill: 'var(--fg-3)' }} allowDecimals={false} />
                                    <Tooltip
                                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)' }}
                                      labelFormatter={d => `${t('att.session_label')}: ${d}`}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                                    <Bar dataKey="present" name={t('att.present')} stackId="a" fill="#10B981" radius={[0,0,0,0]} />
                                    <Bar dataKey="absent"  name={t('att.absent')}  stackId="a" fill="#F87171" radius={[0,0,0,0]} />
                                    <Bar dataKey="makeup"  name={t('att.makeup')}  stackId="a" fill="#F59E0B" radius={[3,3,0,0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Teachers section */}
          {teachers.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700 }}>{t('analytics.teacher_title')}</h2>
                  <p className="text-fg2" style={{ fontSize: 13, marginTop: 2 }}>{teachers.length} {t('nav.teachers')}</p>
                </div>
                <Link href="/dashboard/admin/analytics" style={{ color: '#0EA5E9', fontSize: 13, textDecoration: 'none' }}>{t('dash.full_analytics')} →</Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {teachers.map(teacher => {
                  const isExpanded = expandedTeacherId === teacher.teacher_id;
                  const teacherCourses = courseBreakdown.filter(c => c.teacher_name === teacher.name);
                  const activeCourses = teacherCourses.filter(c => c.status === 'Active');
                  const oldCourses = teacherCourses.filter(c => c.status !== 'Active');
                  const rateColor = teacher.completion_rate >= 75 ? '#10B981' : teacher.completion_rate >= 40 ? '#F59E0B' : '#F87171';

                  return (
                    <div key={teacher.teacher_id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: isExpanded ? 'var(--surface-2)' : 'transparent', transition: 'background 0.2s' }}>

                      {/* Compact row */}
                      <div
                        onClick={() => setExpandedTeacherId(isExpanded ? null : teacher.teacher_id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer', userSelect: 'none', borderBottom: isExpanded ? '1px solid var(--border-soft)' : 'none' }}
                        onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
                        onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        {/* Avatar initials */}
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0EA5E920', border: '1px solid #0EA5E940', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0EA5E9' }}>
                            {teacher.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>

                        {/* Name + email */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="text-fg" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{teacher.name}</p>
                          <p className="text-fg3" style={{ fontSize: 11, margin: 0, marginTop: 1 }}>{teacher.email}</p>
                        </div>

                        {/* Stats pills */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                            <strong style={{ color: '#0EA5E9' }}>{teacher.courses}</strong> {t('nav.courses').toLowerCase()}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                            <strong style={{ color: '#8B5CF6' }}>{teacher.students}</strong> {t('nav.students').toLowerCase()}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: rateColor }}>{teacher.completion_rate}%</span>
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded: courses list */}
                      {isExpanded && (
                        <div style={{ padding: '16px 20px' }}>

                          {/* Overall completion bar */}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span className="text-fg2" style={{ fontSize: 12 }}>{t('dash.completion_rate')}</span>
                              <span style={{ color: rateColor, fontSize: 12, fontWeight: 700 }}>{teacher.completion_rate}%</span>
                            </div>
                            <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                              <div style={{ width: `${teacher.completion_rate}%`, height: '100%', background: rateColor, borderRadius: 99, transition: 'width 0.6s' }} />
                            </div>
                          </div>

                          {/* Active courses */}
                          {activeCourses.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                {t('course.status_active')} ({activeCourses.length})
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {activeCourses.map(c => {
                                  const cStats = curriculumStats[c.course_id];
                                  const conducted = cStats?.sessions_with_records ?? 0;
                                  const planned = cStats?.total_sessions ?? 0;
                                  const cr = c.completion_rate >= 75 ? '#10B981' : c.completion_rate >= 40 ? '#F59E0B' : '#F87171';
                                  return (
                                    <div key={c.course_id} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '10px 14px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <p className="text-fg" style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{c.title}</p>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                          {conducted > 0 && planned > 0 && (
                                            <span style={{ fontSize: 11, color: '#0EA5E9', fontWeight: 600 }}>{conducted}/{planned} {t('dash.sessions_unit')}</span>
                                          )}
                                          <span style={{ fontSize: 12, fontWeight: 700, color: cr }}>{c.completion_rate}%</span>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: 8 }}>
                                        <div style={{ flex: 1, background: 'var(--border-soft)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
                                          <div style={{ width: `${c.completion_rate}%`, height: '100%', background: cr, borderRadius: 99 }} />
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                                        {[
                                          { val: c.ongoing, label: t('enr.status_ongoing'), color: '#0EA5E9' },
                                          { val: c.completed, label: t('enr.status_completed'), color: '#10B981' },
                                          { val: c.dropped, label: t('enr.status_dropped'), color: '#F87171' },
                                        ].map(({ val, label, color }) => (
                                          <span key={label} style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                                            <strong style={{ color }}>{val}</strong> {label}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Older / inactive courses */}
                          {oldCourses.length > 0 && (
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                                {t('course.status_inactive')} ({oldCourses.length})
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {oldCourses.map(c => (
                                  <div key={c.course_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, opacity: 0.8 }}>
                                    <p className="text-fg2" style={{ fontSize: 13, margin: 0 }}>{c.title}</p>
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                      <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.total} {t('nav.students').toLowerCase()}</span>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: c.completion_rate >= 75 ? '#10B981' : '#F59E0B' }}>{c.completion_rate}%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {teacherCourses.length === 0 && (
                            <p className="text-fg3" style={{ fontSize: 13 }}>{t('course.none')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Students */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700 }}>{t('dash.completed_students_title')} <span style={{ color: '#10B981', fontWeight: 800 }}>({completedStudents.length})</span></h2>
                <p className="text-fg2" style={{ fontSize: 13, marginTop: 2 }}>{t('dash.completed_students_sub')}</p>
              </div>
              <Link href="/dashboard/admin/reports" style={{ color: '#0EA5E9', fontSize: 13, textDecoration: 'none', whiteSpace: 'nowrap' }}>{t('dash.view_all_reports')}</Link>
            </div>
            {completedStudents.length === 0 ? (
              <p className="text-fg3" style={{ fontSize: 14, padding: '16px 0' }}>{t('reports.no_enrollments')}</p>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {[t('reports.col_student'), t('reports.col_number'), t('analytics.col_course'), t('analytics.col_avg_grade')].map(h => (
                        <th key={h} className="label-xs" style={{ padding: '8px 12px', textAlign: 'start', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {completedStudents.map(r => (
                      <tr key={r.enrollment_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--fg)', fontWeight: 500 }}>{r.student_name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--fg-2)', fontFamily: 'monospace' }}>{r.student_number}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--fg-2)' }}>{r.course_title}</td>
                        <td style={{ padding: '10px 12px', color: '#10B981', fontWeight: 700 }}>{r.avg_grade != null ? r.avg_grade : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              {I(PATHS.export, 16, 'var(--fg-2)')}
              <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700 }}>{t('dash.export_title')}</h2>
            </div>
            <p className="text-fg2" style={{ fontSize: 13, marginBottom: 16 }}>{t('dash.export_subtitle')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label className="text-fg" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('enr.pick_course')}</label>
                <select value={exportCourse} onChange={e => setExportCourse(e.target.value)} style={inp}>
                  <option value="">{t('reports.all_courses')}</option>
                  {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-fg" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('reports.from')}</label>
                <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} style={inp} />
              </div>
              <div>
                <label className="text-fg" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('reports.to')}</label>
                <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} style={inp} />
              </div>
              <button onClick={handleExport} disabled={exporting} style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {exporting ? t('reports.exporting') : t('reports.export')}
              </button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
