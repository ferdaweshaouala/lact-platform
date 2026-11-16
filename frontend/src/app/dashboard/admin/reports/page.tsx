'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { analyticsApi, coursesApi, exportApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { useT } from '@/lib/i18n';

interface Enrollment {
  enrollment_id: number;
  student_name: string;
  student_number: string;
  course_title: string;
  enrollment_date: string;
  completion_status: string;
  avg_grade: number | null;
  grade_count: number;
}

interface Course { course_id: number; title: string; }
interface AtRisk {
  enrollment_id: number; student_id: number; student_name: string;
  student_number: string; course_id: number; course_title: string;
  absences: number; total_pct: number;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Ongoing:   { bg: 'rgba(14,165,233,0.12)',  color: '#0EA5E9' },
  Completed: { bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
  Dropped:   { bg: 'rgba(248,113,113,0.12)', color: '#F87171' },
};

export default function AdminReports() {
  const { user, loading } = useRequireRole('admin');
  const { t } = useT();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);
  const [atRiskThreshold, setAtRiskThreshold] = useState(50);
  const [dataLoading, setDataLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // filters
  const [filterCourse, setFilterCourse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.role === 'admin') {
      Promise.all([
        coursesApi.list().then(r => setCourses(r.data)),
        analyticsApi.report().then(r => setRows(r.data.items ?? r.data)),
      ]).catch(() => setError(t('reports.error_load'))).finally(() => setDataLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    analyticsApi.atRisk(atRiskThreshold).then(r => setAtRisk(r.data)).catch(() => {});
  }, [user, atRiskThreshold]);

  const selectedCourseTitle = courses.find(c => String(c.course_id) === filterCourse)?.title;

  const filtered = rows.filter(r => {
    if (filterCourse && r.course_title !== selectedCourseTitle) return false;
    if (filterStatus && r.completion_status !== filterStatus) return false;
    if (filterFrom && r.enrollment_date < filterFrom) return false;
    if (filterTo && r.enrollment_date > filterTo) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.student_name.toLowerCase().includes(q) && !r.student_number.toLowerCase().includes(q) && !r.course_title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportApi.enrollments({
        course_id: filterCourse ? parseInt(filterCourse) : undefined,
        date_from: filterFrom || undefined,
        date_to: filterTo || undefined,
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'enrollments_report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('reports.error_export'));
    } finally {
      setExporting(false);
    }
  };

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 };
  const inputStyle = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', fontFamily: "'DM Sans', sans-serif", background: 'var(--input-bg)', color: 'var(--fg)' };

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">{t('reports.title')}</h1>
        <p className="page-sub">{t('reports.subtitle')}</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '12px 16px', color: '#F87171', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('enr.pick_course')}</label>
            <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} style={inputStyle}>
              <option value="">{t('reports.all_courses')}</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('common.status')}</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
              <option value="">{t('reports.all_statuses')}</option>
              <option value="Ongoing">{t('enr.status_ongoing')}</option>
              <option value="Completed">{t('enr.status_completed')}</option>
              <option value="Dropped">{t('enr.status_dropped')}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('reports.from')}</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('reports.to')}</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={inputStyle} />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ background: 'var(--fg)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1, whiteSpace: 'nowrap', height: 38 }}
          >
            {exporting ? t('reports.exporting') : t('reports.export')}
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <input
            type="text"
            placeholder={t('reports.search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* At-risk students */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
            {t('reports.at_risk_title')} <span style={{ color: '#F87171', fontSize: 14 }}>({atRisk.length})</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-2)' }}>
            <span>{t('reports.threshold')}:</span>
            <input type="number" min={0} max={100} value={atRiskThreshold}
              onChange={e => setAtRiskThreshold(parseInt(e.target.value || '50', 10))}
              style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--input-bg)', color: 'var(--fg)' }} />
            <span>%</span>
          </div>
        </div>
        {atRisk.length === 0 ? (
          <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>{t('reports.at_risk_none')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {atRisk.map(r => (
              <div key={r.enrollment_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{r.student_name}</span>
                  <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{r.course_title} · {r.absences} {t('enr.absences').toLowerCase()}</span>
                </div>
                <span style={{ color: '#B91C1C', fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{r.total_pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['Ongoing', 'Completed', 'Dropped'] as const).map(s => {
          const count = filtered.filter(r => r.completion_status === s).length;
          const c = STATUS_COLORS[s];
          const label = s === 'Ongoing' ? t('enr.status_ongoing') : s === 'Completed' ? t('enr.status_completed') : t('enr.status_dropped');
          return (
            <div key={s} style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}33`, borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
              {label}: {count}
            </div>
          );
        })}
        <div style={{ background: 'var(--surface-2)', color: 'var(--fg-2)', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
          {t('reports.total')}: {filtered.length}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {dataLoading ? (
          <div style={{ color: 'var(--fg-3)', fontSize: 14, padding: 40, textAlign: 'center' }}>{t('common.loading')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[t('reports.col_student'), t('reports.col_number'), t('analytics.col_course'), t('reports.col_enrolled'), t('common.status'), t('analytics.col_avg_grade'), t('reports.col_grades')].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const sc = STATUS_COLORS[r.completion_status] || { bg: 'var(--surface-2)', color: 'var(--fg-2)' };
                  return (
                    <tr key={r.enrollment_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--fg)', fontSize: 13, fontWeight: 500 }}>{r.student_name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--fg-2)', fontSize: 13, fontFamily: 'monospace' }}>{r.student_number}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--fg-2)', fontSize: 13 }}>{r.course_title}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--fg-2)', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {r.enrollment_date ? new Date(r.enrollment_date).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: sc.bg, color: sc.color, fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20 }}>
                          {r.completion_status === 'Ongoing' ? t('enr.status_ongoing') : r.completion_status === 'Completed' ? t('enr.status_completed') : t('enr.status_dropped')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--fg)', fontSize: 13, fontWeight: 600 }}>
                        {r.avg_grade != null ? r.avg_grade : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--fg-2)', fontSize: 13 }}>{r.grade_count ?? 0}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
                      {rows.length === 0 ? t('reports.no_enrollments') : t('reports.no_results')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
