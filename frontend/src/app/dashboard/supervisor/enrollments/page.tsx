'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { coursesApi, studentsApi, enrollmentsApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonTable } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';
import ConfirmModal from '@/components/ConfirmModal';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';

interface Course { course_id: number; title: string; }
interface Student { student_id: number; first_name: string; last_name: string; student_number: string; }
interface Enrollment {
  enrollment_id: number; student_id: number; course_id: number;
  enrollment_date: string | null; completion_status: string;
    approval_status: string;
  absences: number; attendance_count: number; makeup_count: number;
}

const statusColors: Record<string, string> = { Completed: '#34D399', Ongoing: '#0EA5E9', Dropped: '#F87171' };

function EnrollmentsPageInner() {
  const { user, loading } = useRequireRole('supervisor');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useT();
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(
    searchParams.get('course') ? parseInt(searchParams.get('course')!) : null
  );
  const [addStudentId, setAddStudentId] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<{ id: number; subject: string } | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'supervisor') {
      Promise.all([
        coursesApi.list().then(res => {
          setCourses(res.data);
          if (res.data.length && selectedCourseId === null) {
            const first = res.data[0].course_id;
            setSelectedCourseId(first);
            router.replace(`?course=${first}`, { scroll: false });
          }
        }),
        studentsApi.list().then(res => setStudents(res.data.items ?? res.data)),
        enrollmentsApi.list().then(res => setEnrollments(res.data)),
      ]).finally(() => setDataLoading(false));
    }
  }, [user]);

  const refreshEnrollments = () => enrollmentsApi.list().then(res => setEnrollments(res.data));

  const courseEnrollments = enrollments.filter(e => e.course_id === selectedCourseId);
  const pendingEnrollments = enrollments.filter(e => e.approval_status === 'pending');
  const enrolledIds = new Set(courseEnrollments.map(e => e.student_id));
  const availableStudents = students.filter(s => !enrolledIds.has(s.student_id));
  const studentById = (id: number) => students.find(s => s.student_id === id);

  const handleApprove = async (id: number) => {
  try {
    await enrollmentsApi.update(id, { approval_status: 'approved' });
    refreshEnrollments();
    toast.success('تمت الموافقة على الطلب');
  } catch {
    toast.error(t('common.error'));
  }
};

const handleReject = async (id: number) => {
  try {
    await enrollmentsApi.update(id, { approval_status: 'rejected' });
    refreshEnrollments();
    toast.success('تم رفض الطلب');
  } catch {
    toast.error(t('common.error'));
  }
};
 
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStudentId || !selectedCourseId) return;
    setAddLoading(true);
    try {
      await enrollmentsApi.create({ student_id: parseInt(addStudentId), course_id: selectedCourseId, completion_status: 'Ongoing' });
      setAddStudentId('');
      refreshEnrollments();
      toast.success(t('enr.enrolled_success'));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e.response?.data?.detail || t('common.error'));
    } finally {
      setAddLoading(false);
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await enrollmentsApi.update(id, { completion_status: status });
      refreshEnrollments();
      toast.success(t('enr.status_updated'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const patchField = async (id: number, patch: Record<string, unknown>) => {
    try {
      await enrollmentsApi.update(id, patch);
      setEnrollments(prev => prev.map(e => e.enrollment_id === id ? { ...e, ...patch } as Enrollment : e));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await enrollmentsApi.delete(id);
      setConfirmRemove(null);
      refreshEnrollments();
      toast.success(t('enr.unenrolled_success'));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      toast.error(e.response?.data?.detail || t('common.error'));
      setConfirmRemove(null);
    }
  };

  const selectStyle = { padding: '10px 12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: 14, outline: 'none' };

  if (loading || !user) return <DashboardLayout><SkeletonTable rows={6} cols={5} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">{t('nav.enrollments')}</h1>
        <p className="page-sub">{t('enr.assign_subtitle')}</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('enr.pick_course')}</label>
        <select style={{ ...selectStyle, minWidth: 320 }} value={selectedCourseId || ''} onChange={e => {
          const id = Number(e.target.value);
          setSelectedCourseId(id);
          router.replace(`?course=${id}`, { scroll: false });
        }}>
          {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h2 style={{ color: 'var(--fg)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('enr.enroll_student')}</h2>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10 }}>
          <select required value={addStudentId} onChange={e => setAddStudentId(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
            <option value="">{t('enr.pick_student')}</option>
            {availableStudents.map(s => (
              <option key={s.student_id} value={s.student_id}>{s.student_number} — {s.first_name} {s.last_name}</option>
            ))}
          </select>
          <button type="submit" disabled={!addStudentId || addLoading}
            style={{ padding: '10px 20px', background: addStudentId && !addLoading ? 'linear-gradient(135deg, #10B981, #059669)' : 'var(--border)', border: 'none', borderRadius: 8, color: addStudentId && !addLoading ? 'white' : 'var(--fg-3)', fontSize: 14, fontWeight: 600, cursor: addStudentId && !addLoading ? 'pointer' : 'not-allowed', minWidth: 90 }}>
            {addLoading ? '...' : t('enr.enroll')}
          </button>
        </form>
        {availableStudents.length === 0 && <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 10 }}>{t('enr.all_enrolled')}</p>}
      </div>

      {dataLoading ? <SkeletonTable rows={4} cols={5} /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ color: 'var(--fg)', fontSize: 16, fontWeight: 700 }}>{t('enr.enrolled_count', { n: courseEnrollments.length })}</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[t('student.number'), t('common.name'), t('enr.enrolled_on'), t('common.status'), t('enr.attendance'), t('enr.absences'), t('enr.makeup'), t('common.actions')].map(h => (
                  <th key={h} style={{ padding: '14px 12px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courseEnrollments.map(en => {
                const s = studentById(en.student_id);
                const numCellStyle = { width: 64, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--fg)', background: 'var(--input-bg)', outline: 'none' };
                return (
                  <tr key={en.enrollment_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '12px', color: '#0EA5E9', fontSize: 13, fontFamily: 'monospace' }}>{s?.student_number || '—'}</td>
                    <td style={{ padding: '12px', color: 'var(--fg)', fontSize: 14, fontWeight: 500 }}>{s ? `${s.first_name} ${s.last_name}` : '—'}</td>
                    <td style={{ padding: '12px', color: 'var(--fg-2)', fontSize: 13 }}>{en.enrollment_date || '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <select value={en.completion_status} onChange={e => handleStatusChange(en.enrollment_id, e.target.value)}
                        style={{ padding: '4px 10px', background: `${statusColors[en.completion_status]}18`, border: `1px solid ${statusColors[en.completion_status]}40`, borderRadius: 20, fontSize: 11, fontWeight: 600, color: statusColors[en.completion_status], outline: 'none', cursor: 'pointer' }}>
                        <option value="Ongoing">{t('enr.status_ongoing')}</option>
                        <option value="Completed">{t('enr.status_completed')}</option>
                        <option value="Dropped">{t('enr.status_dropped')}</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <input type="number" min={0} defaultValue={en.attendance_count}
                        onBlur={e => { const v = parseInt(e.target.value, 10) || 0; if (en.attendance_count !== v) patchField(en.enrollment_id, { attendance_count: v }); }}
                        style={numCellStyle} />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <input type="number" min={0} defaultValue={en.absences}
                        onBlur={e => { const v = parseInt(e.target.value, 10) || 0; if (en.absences !== v) patchField(en.enrollment_id, { absences: v }); }}
                        style={numCellStyle} />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <input type="number" min={0} defaultValue={en.makeup_count}
                        onBlur={e => { const v = parseInt(e.target.value, 10) || 0; if (en.makeup_count !== v) patchField(en.enrollment_id, { makeup_count: v }); }}
                        style={numCellStyle} />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => {
                          const course = courses.find(c => c.course_id === selectedCourseId);
                          setConfirmRemove({
                            id: en.enrollment_id,
                            subject: `${s ? `${s.first_name} ${s.last_name}` : '—'} — ${course?.title ?? ''}`,
                          });
                        }}
                        style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#F87171', fontSize: 13, cursor: 'pointer' }}
                      >
                        {t('student.unenroll')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {courseEnrollments.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 0, border: 'none' }}>
                  <EmptyState
                    icon="📋"
                    title={t('enr.none')}
                    description="Enroll students using the panel above to get started."
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {confirmRemove !== null && (
        <ConfirmModal
          messageKey='enr.unenroll_confirm'
          subject={confirmRemove.subject}
          confirmLabel={t('common.yes_unenroll')}
          onConfirm={() => handleRemove(confirmRemove.id)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
      {pendingEnrollments.length > 0 && (
  <div style={{ background: 'var(--surface)', border: '1px solid #F59E0B40', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#F59E0B0D' }}>
      <h2 style={{ color: 'var(--fg)', fontSize: 16, fontWeight: 700 }}>
        طلبات تسجيل معلّقة ({pendingEnrollments.length})
      </h2>
    </div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          {['رقم الطالبة', 'الاسم', 'الدورة', 'تاريخ الطلب', 'إجراء'].map(h => (
            <th key={h} style={{ padding: '14px 12px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pendingEnrollments.map(en => {
          const s = studentById(en.student_id);
          const course = courses.find(c => c.course_id === en.course_id);
          return (
            <tr key={en.enrollment_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <td style={{ padding: '12px', color: '#0EA5E9', fontSize: 13, fontFamily: 'monospace' }}>{s?.student_number || '—'}</td>
              <td style={{ padding: '12px', color: 'var(--fg)', fontSize: 14, fontWeight: 500 }}>{s ? `${s.first_name} ${s.last_name}` : '—'}</td>
              <td style={{ padding: '12px', color: 'var(--fg-2)', fontSize: 13 }}>{course?.title || '—'}</td>
              <td style={{ padding: '12px', color: 'var(--fg-2)', fontSize: 13 }}>{en.enrollment_date || '—'}</td>
              <td style={{ padding: '12px', display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleApprove(en.enrollment_id)}
                  style={{ padding: '5px 14px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 6, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  موافقة
                </button>
                <button
                  onClick={() => handleReject(en.enrollment_id)}
                  style={{ padding: '5px 14px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#F87171', fontSize: 13, cursor: 'pointer' }}
                >
                  رفض
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}
    </DashboardLayout>
  );
}

export default function EnrollmentsPage() {
  return <Suspense><EnrollmentsPageInner /></Suspense>;
}
