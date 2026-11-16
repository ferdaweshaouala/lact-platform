'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { studentsApi, enrollmentsApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonTable } from '@/components/Skeleton';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

interface Student {
  student_id: number;
  first_name: string;
  last_name: string;
  student_number: string;
  email: string | null;
}

interface Enrollment {
  enrollment_id: number;
  student_id: number;
  course_id: number;
  completion_status: string;
}

const statusColors: Record<string, string> = {
  Completed: '#34D399', Ongoing: '#0EA5E9', Dropped: '#F87171',
};

export default function TeacherStudentsPage() {
  const { user, loading } = useRequireRole('teacher');
  const router = useRouter();
  const { t } = useT();
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (user?.role === 'teacher') {
      Promise.all([
        studentsApi.list().then(res => setStudents(res.data.items ?? res.data)),
        enrollmentsApi.list().then(res => setEnrollments(res.data)),
      ]).finally(() => setDataLoading(false));
    }
  }, [user]);

  const getStatus = (studentId: number) => {
    const e = enrollments.filter(e => e.student_id === studentId);
    if (e.length === 0) return null;
    if (e.some(e => e.completion_status === 'Ongoing')) return 'Ongoing';
    if (e.every(e => e.completion_status === 'Completed')) return 'Completed';
    if (e.some(e => e.completion_status === 'Dropped')) return 'Dropped';
    return 'Ongoing';
  };

  const filtered = students.filter(s =>
    `${s.first_name} ${s.last_name} ${s.student_number}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading || !user) return <DashboardLayout><SkeletonTable rows={6} cols={5} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">{t('nav.my_students')}</h1>
        <p className="page-sub">{t('student.assigned_subtitle', { n: students.length })}</p>
      </div>

      <input
        placeholder={t('student.search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: 360, padding: '10px 12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: 14, outline: 'none', marginBottom: 20 }}
      />

      {dataLoading ? <SkeletonTable rows={5} cols={5} /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '14%' }} /> {/* student number */}
              <col style={{ width: '22%' }} /> {/* name */}
              <col style={{ width: '30%' }} /> {/* email */}
              <col style={{ width: '16%' }} /> {/* enrollments */}
              <col style={{ width: '10%' }} /> {/* status */}
              <col style={{ width: '8%' }} />  {/* actions */}
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                {[
                  t('student.number'),
                  t('common.name'),
                  t('common.email'),
                  t('nav.enrollments'),
                  t('common.status'),
                  t('common.actions'),
                ].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const status = getStatus(s.student_id);
                const enrCount = enrollments.filter(e => e.student_id === s.student_id).length;
                const completedCount = enrollments.filter(e => e.student_id === s.student_id && e.completion_status === 'Completed').length;
                return (
                  <tr key={s.student_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '12px 16px', color: '#0EA5E9', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.student_number}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--fg)', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.first_name} {s.last_name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--fg-2)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {enrCount > 0 ? (
                        <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>
                          <strong style={{ color: 'var(--fg)', fontWeight: 700 }}>{completedCount}</strong>/{enrCount}
                        </span>
                      ) : <span style={{ color: 'var(--fg-3)', fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {status ? (
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', background: `${statusColors[status]}18`, color: statusColors[status], border: `1px solid ${statusColors[status]}40` }}>
                          {t(`enr.status_${status.toLowerCase()}`)}
                        </span>
                      ) : <span style={{ color: 'var(--fg-3)', fontSize: 13 }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/dashboard/teacher/students/${s.student_id}`}
                        style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: '#0EA5E9', fontSize: 12, fontWeight: 600, textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}>
                        {t('common.view')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
                  {search ? t('common.no_results') : t('student.none_assigned')}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
