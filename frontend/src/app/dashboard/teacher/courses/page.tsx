'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { coursesApi, enrollmentsApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonTable } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';
import Link from 'next/link';

interface Course {
  course_id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

interface Enrollment {
  course_id: number;
  completion_status: string;
}

const statusColors: Record<string, string> = {
  Active: '#10B981',
  Inactive: '#64748B',
};

export default function TeacherCoursesPage() {
  const { user, loading } = useRequireRole('teacher');
  const router = useRouter();
  const { t } = useT();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.role === 'teacher') {
      Promise.all([
        coursesApi.list().then(res => setCourses(res.data)),
        enrollmentsApi.list().then(res => setEnrollments(res.data)),
      ]).finally(() => setDataLoading(false));
    }
  }, [user]);

  const enrollmentCount = (courseId: number) =>
    enrollments.filter(e => e.course_id === courseId).length;

  const completedCount = (courseId: number) =>
    enrollments.filter(e => e.course_id === courseId && e.completion_status === 'Completed').length;

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading || !user) return <DashboardLayout><SkeletonTable rows={6} cols={5} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">{t('nav.courses')}</h1>
        <p className="page-sub">{t('course.assigned_subtitle', { n: courses.length })}</p>
      </div>

      <input
        placeholder={t('course.search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', maxWidth: 360, padding: '10px 12px',
          background: 'var(--input-bg)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--fg)', fontSize: 14,
          outline: 'none', marginBottom: 20,
        }}
      />

      {dataLoading ? <SkeletonTable rows={5} cols={5} /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[t('course.title'), t('course.dates'), t('dash.total_enrollments'), t('course.completed'), t('common.status'), t('common.actions')].map(h => (
                  <th key={h} style={{
                    padding: '14px 20px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: 'var(--fg-2)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const total = enrollmentCount(c.course_id);
                const done = completedCount(c.course_id);
                return (
                  <tr key={c.course_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <p style={{ color: 'var(--fg)', fontSize: 14, fontWeight: 500 }}>{c.title}</p>
                      {c.description && (
                        <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 2 }}>
                          {c.description.length > 60 ? c.description.slice(0, 60) + '…' : c.description}
                        </p>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 13 }}>
                      {c.start_date || '—'} → {c.end_date || '—'}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--fg)', fontSize: 14, fontWeight: 600 }}>
                      {total}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#10B981', fontSize: 14, fontWeight: 600 }}>
                      {done}
                      {total > 0 && (
                        <span style={{ color: 'var(--fg-3)', fontSize: 13, fontWeight: 400, marginLeft: 4 }}>
                          ({Math.round((done / total) * 100)}%)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 600,
                        background: `${statusColors[c.status] ?? '#64748B'}18`,
                        color: statusColors[c.status] ?? '#64748B',
                        border: `1px solid ${statusColors[c.status] ?? '#64748B'}40`,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {t(`course.status_${c.status.toLowerCase()}`)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link href={`/dashboard/supervisor/courses/${c.course_id}/gradebook`} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: '#10B981', fontSize: 13, textDecoration: 'none' }}>{t('gradebook.open')}</Link>
                        <Link href={`/dashboard/supervisor/courses/${c.course_id}/attendance`} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: '#8B5CF6', fontSize: 13, textDecoration: 'none' }}>{t('att.open')}</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
                    {search ? t('common.no_results') : t('course.none_assigned')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
