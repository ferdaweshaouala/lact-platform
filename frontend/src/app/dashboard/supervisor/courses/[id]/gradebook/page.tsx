'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireRole } from '@/hooks/useRequireRole';
import { gradebookApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumb from '@/components/Breadcrumb';
import { useT } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type Kind = 'regular' | 'weekly' | 'bonus';

interface Category { id: number; name: string; max_value: number; kind: Kind; order_index: number; }
interface CellGrade { grade_id: number; value: number; session_number: number | null; }
interface Row {
  enrollment_id: number; student_id: number;
  first_name: string; last_name: string; student_number: string;
  absences: number; attendance_count: number; makeup_count: number;
  completion_status: string;
  grades_by_category: Record<string, CellGrade[]>;
  total_pct: number | null;
}
interface Gradebook {
  course: { course_id: number; title: string };
  categories: Category[];
  rows: Row[];
}

const totalColor = (v: number | null) => v == null ? '#94A3B8' : v >= 70 ? '#10B981' : v >= 50 ? '#F59E0B' : '#F87171';

export default function GradebookPage() {
  const { user, loading } = useRequireRole(['supervisor', 'admin', 'teacher']);
  const { t } = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = parseInt(params.id, 10);

  const [data, setData] = useState<Gradebook | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !Number.isFinite(courseId)) return;
    setDataLoading(true);
    gradebookApi.get(courseId)
      .then(r => setData(r.data))
      .catch(() => setError(t('common.error')))
      .finally(() => setDataLoading(false));
  }, [user, courseId, t]);

  // Grade distribution histogram computed from loaded rows
  const gradeHistogram = useMemo(() => {
    if (!data) return [];
    const BUCKETS = [
      { label: '0–9', min: 0, max: 10 },
      { label: '10–19', min: 10, max: 20 },
      { label: '20–29', min: 20, max: 30 },
      { label: '30–39', min: 30, max: 40 },
      { label: '40–49', min: 40, max: 50 },
      { label: '50–59', min: 50, max: 60 },
      { label: '60–69', min: 60, max: 70 },
      { label: '70–79', min: 70, max: 80 },
      { label: '80–89', min: 80, max: 90 },
      { label: '90–100', min: 90, max: 101 },
    ];
    const scored = data.rows.filter(r => r.total_pct != null);
    return BUCKETS.map(b => ({
      label: b.label,
      count: scored.filter(r => (r.total_pct as number) >= b.min && (r.total_pct as number) < b.max).length,
    }));
  }, [data]);

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  const renderCell = (cat: Category, entries: CellGrade[]) => {
    if (entries.length === 0) return <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>—</span>;
    if (cat.kind === 'weekly') {
      const sum = entries.reduce((s, e) => s + e.value, 0);
      const avg = Math.round((sum / entries.length) * 100) / 100;
      return (
        <div title={entries.sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0)).map(e => `${e.session_number ?? '?'}: ${e.value}`).join(' · ')}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{avg}</span>
          <span style={{ fontSize: 10, color: 'var(--fg-3)', marginInlineStart: 4 }}>/{cat.max_value}</span>
          <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>{entries.length}×</div>
        </div>
      );
    }
    const total = entries.reduce((s, e) => s + e.value, 0);
    return (
      <span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{total}</span>
        <span style={{ fontSize: 10, color: 'var(--fg-3)', marginInlineStart: 4 }}>/{cat.max_value}</span>
      </span>
    );
  };

  return (
    <DashboardLayout>
      <Breadcrumb crumbs={[
        { label: t('nav.courses'), href: user.role === 'teacher' ? '/dashboard/teacher/courses' : '/dashboard/supervisor/courses' },
        { label: data?.course.title || '…' },
        { label: t('gradebook.title') },
      ]} />

      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">{t('gradebook.title')}</h1>
        <p className="page-sub">{data?.course.title || '…'}</p>
        <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 6 }}>{t('gradebook.subtitle')}</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '12px 16px', color: '#F87171', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Grade distribution histogram — only render when data is available and has scored rows */}
      {data && gradeHistogram.some(b => b.count > 0) && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>{t('gradebook.dist_title')}</p>
          <p style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 16 }}>{t('gradebook.dist_sub')}</p>
          <div dir="ltr">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={gradeHistogram} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--fg-2)' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--fg-2)' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)' }}
                  formatter={(v: number) => [v, t('gradebook.dist_students')]}
                />
                <Bar dataKey="count" name={t('gradebook.dist_students')} radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {gradeHistogram.map((entry, i) => {
                    const midpoint = (i * 10) + 5;
                    const color = midpoint >= 70 ? '#10B981' : midpoint >= 50 ? '#F59E0B' : '#F87171';
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {dataLoading || !data ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>{t('common.loading')}</div>
        ) : data.rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>{t('enr.none')}</div>
        ) : data.categories.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>{t('cat.none')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <th style={thStyle}>{t('common.name')}</th>
                  {data.categories.map(c => (
                    <th key={c.id} style={{ ...thStyle, textAlign: 'center' }}>
                      {c.name}
                      <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 400, marginTop: 2 }}>
                        /{c.max_value}{c.kind !== 'regular' ? ` · ${t(`cat.kind_${c.kind}`)}` : ''}
                      </div>
                    </th>
                  ))}
                  <th style={{ ...thStyle, textAlign: 'center' }}>{t('gradebook.attendance_short')}</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>{t('gradebook.total')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.enrollment_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={tdStyle}>
                      <Link href={`/dashboard/teacher/students/${r.student_id}`} style={{ color: 'var(--fg)', fontWeight: 600, textDecoration: 'none' }}>
                        {r.first_name} {r.last_name}
                      </Link>
                      <div style={{ color: 'var(--fg-3)', fontSize: 10, fontFamily: 'monospace' }}>{r.student_number}</div>
                    </td>
                    {data.categories.map(c => (
                      <td key={c.id} style={{ ...tdStyle, textAlign: 'center' }}>
                        {renderCell(c, r.grades_by_category[String(c.id)] || [])}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#10B981' }}>{r.attendance_count}</span>
                      <span style={{ color: 'var(--fg-3)', margin: '0 4px' }}>·</span>
                      <span style={{ color: '#F87171' }}>{r.absences}</span>
                      {r.makeup_count > 0 && (
                        <>
                          <span style={{ color: 'var(--fg-3)', margin: '0 4px' }}>·</span>
                          <span style={{ color: '#0EA5E9' }}>{r.makeup_count}</span>
                        </>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: totalColor(r.total_pct), fontFamily: "'Syne', sans-serif" }}>
                        {r.total_pct != null ? `${r.total_pct}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const thStyle = { padding: '10px 12px', textAlign: 'start' as const, fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', whiteSpace: 'nowrap' as const };
const tdStyle = { padding: '10px 12px', verticalAlign: 'middle' as const, whiteSpace: 'nowrap' as const };
