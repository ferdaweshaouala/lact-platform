'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { useT } from '@/lib/i18n';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, LabelList,

} from 'recharts';

interface CourseStat {
  course_id: number; title: string; status: string; teacher_name: string;
  course_type: string; total_sessions: number | null;
  total: number; ongoing: number; completed: number; dropped: number;
  completion_rate: number; avg_grade: number | null;
}
interface TeacherStat {
  teacher_id: number; name: string; email: string;
  courses: number; students: number; completed: number; completion_rate: number;
}

const COLORS = { Completed: '#10B981', Ongoing: '#0EA5E9', Dropped: '#F87171' };
const TEACHER_COLORS = ['#10B981', '#0EA5E9', '#8B5CF6', '#F59E0B', '#F43F5E'];

type TTEntry = { name: string; value: number | string; color?: string; fill?: string; unit?: string };
const TT = ({ active, payload, label }: { active?: boolean; payload?: TTEntry[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || p.fill || 'var(--fg)', margin: '2px 0' }}>
          {p.name}: <strong>{p.value}{typeof p.value === 'number' && p.unit ? p.unit : ''}</strong>
        </p>
      ))}
    </div>
  );
};

export default function AdminAnalytics() {
  const { user, loading } = useRequireRole('admin');
  const { t, dir } = useT();
  const isRtl = dir === 'rtl';
  const router = useRouter();
  const [courses, setCourses] = useState<CourseStat[]>([]);
  const [teachers, setTeachers] = useState<TeacherStat[]>([]);
  const [curriculumStats, setCurriculumStats] = useState<Record<number, { total_sessions: number; sessions_with_records: number }>>({});
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') {
      Promise.all([
        analyticsApi.courses().then(r => setCourses(r.data)),
        analyticsApi.teachers().then(r => setTeachers(r.data)),
        analyticsApi.curriculumStats().then(r => setCurriculumStats(r.data)).catch(() => {}),
      ]).finally(() => setDataLoading(false));
    }
  }, [user]);

  const totalOngoing   = courses.reduce((s, c) => s + c.ongoing, 0);
  const totalCompleted = courses.reduce((s, c) => s + c.completed, 0);
  const totalDropped   = courses.reduce((s, c) => s + c.dropped, 0);

  // ── Chart 1: Session progress (Gantt-style) ──────────────────────────────
  const sessionProgressData = courses
    .filter(c => (curriculumStats[c.course_id]?.total_sessions ?? 0) > 0)
    .map(c => {
      const conducted = curriculumStats[c.course_id]?.sessions_with_records ?? 0;
      const total     = curriculumStats[c.course_id]?.total_sessions ?? 0;
      return {
        name: c.title.length > 26 ? c.title.slice(0, 26) + '…' : c.title,
        conducted,
        remaining: total - conducted,
        total,
        pct: Math.round((conducted / total) * 100),
      };
    });

  // ── Chart 2: Online vs Onsite stacked bar ────────────────────────────────
  const onlineCourses  = courses.filter(c => c.course_type === 'online');
  const onsiteCourses  = courses.filter(c => c.course_type !== 'online');
  const typeData = [
    {
      name: t('course.type_online'),
      [t('enr.status_ongoing')]:   onlineCourses.reduce((s, c) => s + c.ongoing, 0),
      [t('enr.status_completed')]: onlineCourses.reduce((s, c) => s + c.completed, 0),
      [t('enr.status_dropped')]:   onlineCourses.reduce((s, c) => s + c.dropped, 0),
    },
    {
      name: t('course.type_onsite'),
      [t('enr.status_ongoing')]:   onsiteCourses.reduce((s, c) => s + c.ongoing, 0),
      [t('enr.status_completed')]: onsiteCourses.reduce((s, c) => s + c.completed, 0),
      [t('enr.status_dropped')]:   onsiteCourses.reduce((s, c) => s + c.dropped, 0),
    },
  ];

  // ── Chart 3: Heatmap — course × status intensity grid ────────────────────
  const heatCourses = courses.filter(c => c.total > 0);

  // ── Chart 4: Teacher radar ────────────────────────────────────────────────
  // Existing completion bar data
  const courseChartData = courses
    .filter(c => c.total > 0)
    .map(c => ({ name: c.title.length > 28 ? c.title.slice(0, 28) + '…' : c.title, completion_pct: c.completion_rate }));

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 };
  const sectionTitle = { fontSize: 16, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 } as const;
  const sectionSub   = { color: 'var(--fg-2)', fontSize: 13, marginBottom: 20 } as const;

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">{t('analytics.title')}</h1>
        <p className="page-sub">{t('analytics.subtitle')}</p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('enr.status_ongoing'),   value: totalOngoing,   color: COLORS.Ongoing },
          { label: t('enr.status_completed'), value: totalCompleted, color: COLORS.Completed },
          { label: t('enr.status_dropped'),   value: totalDropped,   color: COLORS.Dropped },
        ].map(k => (
          <div key={k.label} style={{ ...card, textAlign: 'center' }}>
            <p style={{ color: 'var(--fg-2)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{k.label}</p>
            <p style={{ color: k.color, fontSize: 36, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>{dataLoading ? '—' : k.value}</p>
          </div>
        ))}
      </div>

      {dataLoading ? (
        <div style={{ color: 'var(--fg-3)', fontSize: 14, padding: 40, textAlign: 'center' }}>{t('analytics.loading')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Chart 1: Session progress (Gantt-style) ── */}
          {sessionProgressData.length > 0 && (
            <div style={card}>
              <h2 style={sectionTitle}>{t('analytics.sessions_chart_title')}</h2>
              <p style={sectionSub}>{t('analytics.sessions_chart_sub')}</p>
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={Math.max(160, sessionProgressData.length * 38)}>
                  <BarChart data={sessionProgressData} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--fg-2)' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11, fill: 'var(--fg-2)' }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0]?.payload;
                        return (
                          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                            <p style={{ fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>{label}</p>
                            <p style={{ color: '#0EA5E9', margin: '2px 0' }}>{t('analytics.sessions_conducted')}: <strong>{row.conducted}</strong></p>
                            <p style={{ color: 'var(--fg-3)', margin: '2px 0' }}>{t('analytics.sessions_remaining')}: <strong>{row.remaining}</strong></p>
                            <p style={{ color: 'var(--fg)', margin: '4px 0 0', fontWeight: 700 }}>{t('analytics.sessions_total')}: {row.total} · {row.pct}%</p>
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Bar dataKey="conducted" name={t('analytics.sessions_conducted')} stackId="a" fill="#0EA5E9" radius={[0, 0, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="remaining" name={t('analytics.sessions_remaining')} stackId="a" fill="var(--border-soft)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList
                        position="right"
                        content={(props: any) => {
                          const entry = sessionProgressData[props.index ?? -1];
                          if (!entry) return null;
                          return (
                            <text
                              x={(props.x ?? 0) + (props.width ?? 0) + 6}
                              y={(props.y ?? 0) + (props.height ?? 0) / 2}
                              fontSize={11}
                              fill="var(--fg-2)"
                              dominantBaseline="middle"
                            >
                              {entry.conducted}/{entry.total}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Chart 2: Online vs Onsite stacked bar ── */}
          {(onlineCourses.length > 0 || onsiteCourses.length > 0) && (
            <div style={card}>
              <h2 style={sectionTitle}>{t('analytics.type_chart_title')}</h2>
              <p style={sectionSub}>{t('analytics.type_chart_sub')}</p>
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={typeData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }} barSize={56}>
                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: 'var(--fg)', fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--fg-2)' }} allowDecimals={false} />
                    <Tooltip content={<TT />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey={t('enr.status_ongoing')}   stackId="a" fill={COLORS.Ongoing}   radius={[0,0,0,0]} />
                    <Bar dataKey={t('enr.status_completed')} stackId="a" fill={COLORS.Completed} radius={[0,0,0,0]} />
                    <Bar dataKey={t('enr.status_dropped')}   stackId="a" fill={COLORS.Dropped}   radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Chart 3: Enrollment heatmap ── */}
          {heatCourses.length > 0 && (
            <div style={card}>
              <h2 style={sectionTitle}>{t('analytics.heatmap_title')}</h2>
              <p style={sectionSub}>{t('analytics.heatmap_sub')}</p>
              <div style={{ overflowX: 'auto' }}>
                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 4, marginBottom: 4 }}>
                  <div />
                  {[
                    { label: t('enr.status_ongoing'),   color: COLORS.Ongoing },
                    { label: t('enr.status_completed'), color: COLORS.Completed },
                    { label: t('enr.status_dropped'),   color: COLORS.Dropped },
                  ].map(h => (
                    <div key={h.label} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: h.color, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0' }}>
                      {h.label}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {heatCourses.map(c => {
                  const ongoingPct   = c.total ? c.ongoing   / c.total : 0;
                  const completedPct = c.total ? c.completed / c.total : 0;
                  const droppedPct   = c.total ? c.dropped   / c.total : 0;
                  return (
                    <div key={c.course_id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                      <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingInlineEnd: 8 }}>{c.title}</p>
                      {[
                        { pct: ongoingPct,   val: c.ongoing,   base: COLORS.Ongoing },
                        { pct: completedPct, val: c.completed, base: COLORS.Completed },
                        { pct: droppedPct,   val: c.dropped,   base: COLORS.Dropped },
                      ].map(({ pct, val, base }, i) => (
                        <div key={i} title={`${val} students (${Math.round(pct * 100)}%)`}
                          style={{
                            height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: `${base}${Math.round(pct * 220 + 20).toString(16).padStart(2, '0')}`,
                            border: `1px solid ${base}30`,
                            fontSize: 12, fontWeight: 700,
                            color: pct > 0.4 ? 'white' : 'var(--fg-2)',
                            cursor: 'default',
                          }}>
                          {val > 0 ? val : ''}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Chart 4: Teacher performance table ── */}
          {teachers.filter(tc => tc.students > 0).length > 0 && (
            <div style={card}>
              <h2 style={sectionTitle}>{t('analytics.radar_title')}</h2>
              <p style={sectionSub}>{t('analytics.radar_sub')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {teachers.filter(tc => tc.students > 0).map((teacher, i) => {
                  const color = TEACHER_COLORS[i % TEACHER_COLORS.length];
                  const rate = teacher.completion_rate ?? 0;
                  const rateColor = rate >= 75 ? '#10B981' : rate >= 40 ? '#F59E0B' : '#F87171';
                  return (
                    <div key={teacher.teacher_id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '14px 18px', borderInlineStart: `4px solid ${color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{teacher.name}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: rateColor, fontFamily: "'Syne', sans-serif" }}>{rate}%</span>
                      </div>
                      {/* Completion rate bar */}
                      <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ width: `${rate}%`, height: '100%', background: rateColor, borderRadius: 99, transition: 'width 0.6s ease' }} />
                      </div>
                      {/* Stats row */}
                      <div style={{ display: 'flex', gap: 20 }}>
                        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                          <strong style={{ color: 'var(--fg)', fontSize: 13 }}>{teacher.courses}</strong> {t('analytics.radar_courses')}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                          <strong style={{ color: 'var(--fg)', fontSize: 13 }}>{teacher.students}</strong> {t('analytics.radar_students')}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                          <strong style={{ color: '#10B981', fontSize: 13 }}>{teacher.completed}</strong> {t('enr.status_completed').toLowerCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Completion rate per course ── */}
          <div style={card}>
            <h2 style={sectionTitle}>{t('analytics.course_rate_title')}</h2>
            <p style={sectionSub}>{t('analytics.course_rate_sub')}</p>
            {courseChartData.length === 0 ? (
              <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>{t('analytics.no_enrollment')}</p>
            ) : (
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={courseChartData} margin={{ top: 16, right: 16, left: -10, bottom: 60 }} barSize={36}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'var(--fg-2)' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: 'var(--fg-2)' }} />
                    <Tooltip content={<TT />} />
                    <Bar dataKey="completion_pct" name={t('dash.completion_rate')} radius={[4, 4, 0, 0]} maxBarSize={48}
                      label={{ position: 'top', fontSize: 11, fill: 'var(--fg-2)', formatter: (v: number) => v > 0 ? `${v}%` : '' }}>
                      {courseChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.completion_pct >= 75 ? '#10B981' : entry.completion_pct >= 40 ? '#F59E0B' : entry.completion_pct > 0 ? '#F87171' : 'var(--border-soft)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Course details table (existing) ── */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>{t('analytics.breakdown_title')}</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[t('analytics.col_course'), t('course.type'), t('analytics.col_teacher'), t('analytics.col_total'), t('enr.status_ongoing'), t('enr.status_completed'), t('enr.status_dropped'), t('analytics.col_rate'), t('analytics.col_avg_grade')].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.course_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--fg)', fontSize: 13, fontWeight: 500 }}>
                        {c.title}
                        <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 10, background: c.status === 'Active' ? 'rgba(16,185,129,0.12)' : 'var(--surface-2)', color: c.status === 'Active' ? '#10B981' : 'var(--fg-3)' }}>
                          {c.status === 'Active' ? t('course.status_active') : t('course.status_inactive')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          background: c.course_type === 'online' ? '#8B5CF618' : '#F59E0B18',
                          color: c.course_type === 'online' ? '#8B5CF6' : '#F59E0B',
                          border: `1px solid ${c.course_type === 'online' ? '#8B5CF640' : '#F59E0B40'}` }}>
                          {t(`course.type_${c.course_type || 'onsite'}`)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--fg-2)', fontSize: 13 }}>{c.teacher_name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--fg)', fontSize: 13, fontWeight: 600 }}>{c.total}</td>
                      <td style={{ padding: '12px 16px', color: COLORS.Ongoing,   fontSize: 13, fontWeight: 600 }}>{c.ongoing}</td>
                      <td style={{ padding: '12px 16px', color: COLORS.Completed, fontSize: 13, fontWeight: 600 }}>{c.completed}</td>
                      <td style={{ padding: '12px 16px', color: COLORS.Dropped,   fontSize: 13, fontWeight: 600 }}>{c.dropped}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 99, height: 6, minWidth: 60 }}>
                            <div style={{ width: `${c.completion_rate}%`, height: '100%', background: '#10B981', borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap' }}>{c.completion_rate}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--fg-2)', fontSize: 13 }}>{c.avg_grade ?? '—'}</td>
                    </tr>
                  ))}
                  {courses.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>{t('analytics.no_courses')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </DashboardLayout>
  );
}
