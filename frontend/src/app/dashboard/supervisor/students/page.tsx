'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import { studentsApi, coursesApi, enrollmentsApi } from '@/lib/api';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonTable } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';
import ConfirmModal from '@/components/ConfirmModal';
import EmptyState from '@/components/EmptyState';

interface Student { student_id: number; first_name: string; last_name: string; student_number: string; email: string | null; date_of_birth: string | null; phone_number: string | null; city: string | null; profession: string | null; }
interface Course { course_id: number; title: string; status: string; }
interface Enrollment { enrollment_id: number; student_id: number; course_id: number; completion_status: string; }

const EMPTY_FORM = { first_name: '', last_name: '', student_number: '', email: '', date_of_birth: '', phone_number: '', city: '', profession: '' };
const statusColors: Record<string, string> = { Completed: '#34D399', Ongoing: '#0EA5E9', Dropped: '#F87171' };

function SupervisorStudentsPageInner() {
  const { user, loading } = useRequireRole('supervisor');
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; subject: string } | null>(null);
  const [confirmUnenroll, setConfirmUnenroll] = useState<{ id: number; subject: string } | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const urlDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addCourseIdMap, setAddCourseIdMap] = useState<Record<number, string>>({});

  useEffect(() => {
    if (user?.role === 'supervisor') {
      Promise.all([
        studentsApi.list().then(res => setStudents(res.data.items ?? res.data)),
        coursesApi.list().then(res => setCourses(res.data)),
        enrollmentsApi.list().then(res => setEnrollments(res.data)),
      ]).finally(() => setDataLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (urlDebounce.current) clearTimeout(urlDebounce.current);
    urlDebounce.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      router.replace(`?${params.toString()}`, { scroll: false });
    }, 400);
  }, [search]);

  const fetchStudents = () => studentsApi.list().then(res => setStudents(res.data.items ?? res.data));
  const refreshEnrollments = () => enrollmentsApi.list().then(res => setEnrollments(res.data));

  const enrollmentsOf = (sid: number) => enrollments.filter(e => e.student_id === sid);
  const courseById = (id: number) => courses.find(c => c.course_id === id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { first_name: form.first_name, last_name: form.last_name, student_number: form.student_number, email: form.email || null, date_of_birth: form.date_of_birth || null, phone_number: form.phone_number || null, city: form.city || null, profession: form.profession || null };
    try {
      let studentId = editId;
      if (editId) {
        await studentsApi.update(editId, payload);
      } else {
        const res = await studentsApi.create(payload);
        studentId = res.data.student_id;
      }
      if (!editId && studentId && selectedCourseIds.length > 0) {
        await Promise.all(selectedCourseIds.map(cid => enrollmentsApi.create({ student_id: studentId, course_id: cid, completion_status: 'Ongoing' })));
      }
      setShowForm(false); setForm(EMPTY_FORM); setSelectedCourseIds([]); setEditId(null);
      fetchStudents(); refreshEnrollments();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
    }
  };

  const handleEdit = (s: Student) => {
    setForm({ first_name: s.first_name, last_name: s.last_name, student_number: s.student_number, email: s.email || '', date_of_birth: s.date_of_birth || '', phone_number: s.phone_number || '', city: s.city || '', profession: s.profession || '' });
    setEditId(s.student_id); setSelectedCourseIds([]); setShowForm(true); setConfirmDelete(null);
  };

  const handleDelete = async (id: number) => {
    try {
      await studentsApi.delete(id);
      setConfirmDelete(null); fetchStudents(); refreshEnrollments();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
      setConfirmDelete(null);
    }
  };

  const handleAddEnrollment = async (studentId: number) => {
    const courseId = addCourseIdMap[studentId];
    if (!courseId) return;
    setError('');
    try {
      await enrollmentsApi.create({ student_id: studentId, course_id: parseInt(courseId), completion_status: 'Ongoing' });
      setAddCourseIdMap(prev => { const next = { ...prev }; delete next[studentId]; return next; });
      refreshEnrollments();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: number) => {
    try {
      await enrollmentsApi.delete(enrollmentId);
      setConfirmUnenroll(null); refreshEnrollments();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
      setConfirmUnenroll(null);
    }
  };

  const toggleCourse = (id: number) => setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filtered = students.filter(s => `${s.first_name} ${s.last_name} ${s.student_number}`.toLowerCase().includes(search.toLowerCase()));

  const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block' as const, fontSize: 11, fontWeight: 500 as const, color: 'var(--fg-2)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.06em' };

  if (loading || !user) return <DashboardLayout><SkeletonTable rows={6} cols={5} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title">{t('nav.students')}</h1>
          <p className="page-sub">{t('student.total', { n: students.length })}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/dashboard/supervisor/students/import"
            style={{ padding: '10px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: '#10B981', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            {t('student.import_new_btn')}
          </Link>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setSelectedCourseIds([]); setError(''); }}
            style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {t('student.new_btn')}
          </button>
        </div>
      </div>

      {error && <p style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <input placeholder={t('student.search')} value={search} onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle, marginBottom: 20, maxWidth: 360 }} />

      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, marginBottom: 28 }}>
          <h2 style={{ color: 'var(--fg)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editId ? t('student.edit') : t('student.new')}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Row 1 – الاسم واللقب */}
              <div><label style={labelStyle}>{t('student.first_name')}</label><input style={inputStyle} value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required /></div>
              <div><label style={labelStyle}>{t('student.last_name')}</label><input style={inputStyle} value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required /></div>
              {/* Row 2 – العمر  +  مقر السكن */}
              <div><label style={labelStyle}>{t('student.age')} ({t('student.dob')})</label><input style={inputStyle} type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
              <div><label style={labelStyle}>{t('student.city')}</label><input style={inputStyle} placeholder={t('student.city_placeholder')} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              {/* Row 3 – المهنة  +  رقم الهاتف */}
              <div><label style={labelStyle}>{t('student.profession')}</label><input style={inputStyle} placeholder={t('student.profession_placeholder')} value={form.profession} onChange={e => setForm({ ...form, profession: e.target.value })} /></div>
              <div><label style={labelStyle}>{t('student.phone')}</label><input style={inputStyle} type="tel" placeholder="+213 7xx xxx xxx" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} /></div>
              {/* Row 4 – رقم التسجيل  +  البريد */}
              <div><label style={labelStyle}>{t('student.number')}</label><input style={inputStyle} value={form.student_number} onChange={e => setForm({ ...form, student_number: e.target.value })} required /></div>
              <div><label style={labelStyle}>{t('common.email')}</label><input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            {!editId && courses.length > 0 && (
              <div style={{ marginBottom: 20, padding: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <label style={{ ...labelStyle, marginBottom: 10 }}>{t('student.enroll_in_courses')} ({t('common.optional')})</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {courses.map(c => (
                    <label key={c.course_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--surface)', border: `1px solid ${selectedCourseIds.includes(c.course_id) ? '#10B981' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--fg)' }}>
                      <input type="checkbox" checked={selectedCourseIds.includes(c.course_id)} onChange={() => toggleCourse(c.course_id)} style={{ accentColor: '#10B981' }} />
                      {c.title}
                    </label>
                  ))}
                </div>
                {selectedCourseIds.length > 0 && <p style={{ color: '#10B981', fontSize: 13, marginTop: 10 }}>{t('student.courses_selected', { n: selectedCourseIds.length })}</p>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {editId ? t('common.save_changes') : t('student.create_btn')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {dataLoading ? <SkeletonTable rows={5} cols={5} /> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '10%' }} /> {/* student number */}
              <col style={{ width: '16%' }} /> {/* name */}
              <col style={{ width: '7%' }} />  {/* age */}
              <col style={{ width: '10%' }} /> {/* city */}
              <col style={{ width: '12%' }} /> {/* profession */}
              <col style={{ width: '12%' }} /> {/* phone */}
              <col style={{ width: '11%' }} /> {/* courses */}
              <col style={{ width: '9%' }} />  {/* profile */}
              <col style={{ width: '13%' }} /> {/* actions */}
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                {[t('student.number'), t('common.name'), t('student.age'), t('student.city'), t('student.profession'), t('student.phone'), t('nav.courses'), '', t('common.actions')].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const studentEnrollments = enrollmentsOf(s.student_id);
                const availableCourses = courses.filter(c => !studentEnrollments.some(e => e.course_id === c.course_id));
                const expanded = expandedId === s.student_id;
                return (
                  <Fragment key={s.student_id}>
                    <tr style={{ borderBottom: expanded ? 'none' : '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '14px 20px', color: '#0EA5E9', fontSize: 13, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.student_number}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--fg)', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.first_name} {s.last_name}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {s.date_of_birth
                          ? `${new Date().getFullYear() - new Date(s.date_of_birth).getFullYear()} ${t('student.age_unit')}`
                          : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.city || '—'}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.profession || '—'}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.phone_number
                          ? <a href={`tel:${s.phone_number}`} style={{ color: '#10B981', textDecoration: 'none', fontFamily: 'monospace' }}>{s.phone_number}</a>
                          : '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <button onClick={() => setExpandedId(expanded ? null : s.student_id)}
                          style={{ padding: '4px 12px', background: studentEnrollments.length > 0 ? 'rgba(16,185,129,0.1)' : 'transparent', border: '1px solid var(--border)', borderRadius: 20, color: studentEnrollments.length > 0 ? '#10B981' : 'var(--fg-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          {t('student.n_courses', { n: studentEnrollments.length })} {expanded ? '▴' : '▾'}
                        </button>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <Link href={`/dashboard/supervisor/students/${s.student_id}`}
                          style={{ padding: '5px 12px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 6, color: '#0EA5E9', fontSize: 13, textDecoration: 'none', display: 'inline-block' }}>
                          {t('student.profile')}
                        </Link>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => handleEdit(s)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer' }}>{t('common.edit')}</button>
                          <button onClick={() => setConfirmDelete({ id: s.student_id, subject: `${s.first_name} ${s.last_name} — ${s.student_number}` })} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#F87171', fontSize: 13, cursor: 'pointer' }}>{t('common.delete')}</button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--surface-2)' }}>
                        <td colSpan={9} style={{ padding: '16px 20px' }}>
                          {studentEnrollments.length === 0
                            ? <p style={{ color: 'var(--fg-3)', fontSize: 13, marginBottom: 12 }}>{t('student.not_enrolled')}</p>
                            : (
                              <div style={{ marginBottom: 12 }}>
                                {studentEnrollments.map(en => {
                                  const c = courseById(en.course_id);
                                  return (
                                    <div key={en.enrollment_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 500 }}>{c?.title || `Course #${en.course_id}`}</span>
                                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${statusColors[en.completion_status]}18`, color: statusColors[en.completion_status], border: `1px solid ${statusColors[en.completion_status]}40` }}>
                                          {t(`enr.status_${en.completion_status.toLowerCase()}`)}
                                        </span>
                                      </div>
                                      <button onClick={() => setConfirmUnenroll({ id: en.enrollment_id, subject: `${s.first_name} ${s.last_name} — ${c?.title ?? ''}` })} style={{ padding: '3px 10px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#F87171', fontSize: 11, cursor: 'pointer' }}>{t('student.unenroll')}</button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          {availableCourses.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <select value={addCourseIdMap[s.student_id] || ''} onChange={e => setAddCourseIdMap(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                                style={{ flex: 1, maxWidth: 320, padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: 13, outline: 'none' }}>
                                <option value="">{t('student.add_to_course')}</option>
                                {availableCourses.map(c => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
                              </select>
                              <button onClick={() => handleAddEnrollment(s.student_id)} disabled={!addCourseIdMap[s.student_id]}
                                style={{ padding: '8px 16px', background: addCourseIdMap[s.student_id] ? 'linear-gradient(135deg, #10B981, #059669)' : 'var(--border)', border: 'none', borderRadius: 8, color: addCourseIdMap[s.student_id] ? 'white' : 'var(--fg-3)', fontSize: 13, fontWeight: 600, cursor: addCourseIdMap[s.student_id] ? 'pointer' : 'not-allowed' }}>
                                {t('student.enroll_btn')}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 0, border: 'none' }}>
                  <EmptyState
                    icon={search ? '🔍' : '🎓'}
                    title={search ? t('common.no_results') : t('student.none')}
                    description={search ? t('student.no_search') : t('student.none_desc')}
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {confirmDelete !== null && (
        <ConfirmModal
          messageKey='student.confirm_delete'
          subject={confirmDelete.subject}
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmUnenroll !== null && (
        <ConfirmModal
          messageKey='student.confirm_unenroll'
          subject={confirmUnenroll.subject}
          confirmLabel={t('common.yes_unenroll')}
          onConfirm={() => handleRemoveEnrollment(confirmUnenroll.id)}
          onCancel={() => setConfirmUnenroll(null)}
        />
      )}
    </DashboardLayout>
  );
}

export default function SupervisorStudentsPage() {
  return <Suspense><SupervisorStudentsPageInner /></Suspense>;
}
