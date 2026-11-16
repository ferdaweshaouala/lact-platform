'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useEffect, useState } from 'react';
import { coursesApi, usersApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonTable } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';
import ConfirmModal from '@/components/ConfirmModal';
import EmptyState from '@/components/EmptyState';
import Link from 'next/link';

interface Course {
  course_id: number; title: string; description: string | null;
  start_date: string | null; end_date: string | null;
  status: string; course_type: string; total_sessions: number | null;
  teacher_id: number | null; supervisor_id: number | null;
}
interface StaffUser { user_id: number; first_name: string; last_name: string; role: string; }

const EMPTY_FORM = { title: '', description: '', start_date: '', end_date: '', teacher_id: '', supervisor_id: '', status: 'Active', course_type: 'onsite' };
const statusColors: Record<string, string> = { Active: '#34D399', Inactive: '#64748B' };

export default function SupervisorCoursesPage() {
  const { user, loading } = useRequireRole('supervisor');
  const { t } = useT();
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<StaffUser[]>([]);
  const [supervisors, setSupervisors] = useState<StaffUser[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; subject: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'supervisor') {
      Promise.all([
        coursesApi.list().then(res => setCourses(res.data)),
        usersApi.list().then(res => {
          const all = res.data;
          setTeachers(all.filter((u: StaffUser) => u.role === 'teacher'));
          setSupervisors(all.filter((u: StaffUser) => u.role === 'supervisor'));
        }),
      ]).finally(() => setDataLoading(false));
    }
  }, [user]);

  const fetchCourses = () => coursesApi.list().then(res => setCourses(res.data));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      title: form.title, description: form.description || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      teacher_id: form.teacher_id ? parseInt(form.teacher_id) : null,
      supervisor_id: form.supervisor_id ? parseInt(form.supervisor_id) : null,
      status: form.status,
      course_type: form.course_type,
    };
    try {
      if (editId) await coursesApi.update(editId, payload);
      else await coursesApi.create(payload);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditId(null);
      fetchCourses();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
    }
  };

  const handleEdit = (c: Course) => {
    setForm({ title: c.title, description: c.description || '', start_date: c.start_date || '', end_date: c.end_date || '', teacher_id: c.teacher_id ? String(c.teacher_id) : '', supervisor_id: c.supervisor_id ? String(c.supervisor_id) : '', status: c.status, course_type: c.course_type || 'onsite' });
    setEditId(c.course_id);
    setShowForm(true);
    setConfirmDelete(null);
  };

  const handleDelete = async (id: number) => {
    try {
      await coursesApi.delete(id);
      setConfirmDelete(null);
      fetchCourses();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
      setConfirmDelete(null);
    }
  };

  const staffName = (list: StaffUser[], id: number | null) => {
    if (!id) return '—';
    const u = list.find(u => u.user_id === id);
    return u ? `${u.first_name} ${u.last_name}` : '—';
  };

  const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block' as const, fontSize: 11, fontWeight: 500 as const, color: 'var(--fg-2)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.06em' };

  if (loading || !user) return <DashboardLayout><SkeletonTable rows={6} cols={7} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title">{t('nav.courses')}</h1>
          <p className="page-sub">{t('course.total', { n: courses.length })}</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError(''); }}
          style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {t('course.new_btn')}
        </button>
      </div>

      {error && <p style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, marginBottom: 28 }}>
          <h2 style={{ color: 'var(--fg)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editId ? t('course.edit') : t('course.new')}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>{t('course.title')}</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>{t('course.description')}</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>{t('course.start_date')}</label>
                <input style={inputStyle} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>{t('course.end_date')}</label>
                <input style={inputStyle} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>{t('course.assign_teacher')}</label>
                <select style={inputStyle} value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
                  <option value="">{t('course.unassigned')}</option>
                  {teachers.map(tc => <option key={tc.user_id} value={tc.user_id}>{tc.first_name} {tc.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('course.assign_supervisor')}</label>
                <select style={inputStyle} value={form.supervisor_id} onChange={e => setForm({ ...form, supervisor_id: e.target.value })}>
                  <option value="">{t('course.unassigned')}</option>
                  {supervisors.map(s => <option key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('common.status')}</label>
                <select style={inputStyle} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="Active">{t('course.status_active')}</option>
                  <option value="Inactive">{t('course.status_inactive')}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('course.type')}</label>
                <select style={inputStyle} value={form.course_type} onChange={e => setForm({ ...form, course_type: e.target.value })}>
                  <option value="onsite">{t('course.type_onsite')}</option>
                  <option value="online">{t('course.type_online')}</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {editId ? t('common.save_changes') : t('course.create_btn')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {dataLoading ? <SkeletonTable rows={5} cols={7} /> : courses.length === 0 ? (
        <EmptyState
          icon="📚"
          title={t('course.none')}
          description={t('course.none_desc')}
          action={{ label: t('course.new_btn'), onClick: () => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError(''); } }}
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[t('course.title'), t('course.type'), t('course.teacher'), t('course.supervisor'), t('course.start'), t('course.end'), t('common.status'), t('common.actions')].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.course_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <td style={{ padding: '14px 20px', color: 'var(--fg)', fontSize: 14, fontWeight: 500 }}>{c.title}</td>
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                      background: c.course_type === 'online' ? '#8B5CF618' : '#F59E0B18',
                      color: c.course_type === 'online' ? '#8B5CF6' : '#F59E0B',
                      border: `1px solid ${c.course_type === 'online' ? '#8B5CF640' : '#F59E0B40'}` }}>
                      {t(`course.type_${c.course_type || 'onsite'}`)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 14 }}>{staffName(teachers, c.teacher_id)}</td>
                  <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 14 }}>{staffName(supervisors, c.supervisor_id)}</td>
                  <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 13 }}>{c.start_date || '—'}</td>
                  <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 13 }}>{c.end_date || '—'}</td>
                  <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${statusColors[c.status]}18`, color: statusColors[c.status], border: `1px solid ${statusColors[c.status]}40` }}>
                      {t(`course.status_${c.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Link href={`/dashboard/supervisor/courses/${c.course_id}/gradebook`} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: '#10B981', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }}>{t('gradebook.open')}</Link>
                      <Link href={`/dashboard/supervisor/courses/${c.course_id}/attendance`} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: '#8B5CF6', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }}>{t('att.open')}</Link>
                      <Link href={`/dashboard/supervisor/courses/${c.course_id}/categories`} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: '#0EA5E9', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }}>{t('cat.manage')}</Link>
                      <Link href={`/dashboard/supervisor/courses/${c.course_id}/suivi`} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 6, color: '#10B981', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }}>{t('suivi.open')}</Link>
                      <Link href={`/dashboard/supervisor/courses/${c.course_id}/risk`} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, color: '#EF4444', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }}>{t('risk.open')}</Link>
                      <button onClick={() => handleEdit(c)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer' }}>{t('common.edit')}</button>
                      <button onClick={() => setConfirmDelete({ id: c.course_id, subject: c.title })} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#F87171', fontSize: 13, cursor: 'pointer' }}>{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmDelete !== null && (
        <ConfirmModal
          messageKey='course.confirm_delete'
          subject={confirmDelete.subject}
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </DashboardLayout>
  );
}
