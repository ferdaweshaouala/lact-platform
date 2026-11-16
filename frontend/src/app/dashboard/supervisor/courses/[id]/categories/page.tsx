'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRequireRole } from '@/hooks/useRequireRole';
import { categoriesApi, coursesApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumb from '@/components/Breadcrumb';
import { useT } from '@/lib/i18n';

type Kind = 'regular' | 'weekly' | 'bonus';

interface Category {
  id: number;
  course_id: number;
  name: string;
  max_value: number;
  kind: Kind;
  order_index: number;
}

interface CourseInfo { course_id: number; title: string; }

const emptyDraft = { name: '', max_value: '', kind: 'regular' as Kind, order_index: 0 };

export default function CategoriesPage() {
  const { user, loading } = useRequireRole(['supervisor', 'admin']);
  const { t } = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = parseInt(params.id, 10);

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState<Category | null>(null);
  const [draft, setDraft] = useState<{ name: string; max_value: string; kind: Kind; order_index: number }>(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [otherCourses, setOtherCourses] = useState<CourseInfo[]>([]);
  const [copyFromId, setCopyFromId] = useState('');
  const [copying, setCopying] = useState(false);

  const reload = () => {
    setDataLoading(true);
    Promise.all([
      coursesApi.get(courseId).then(r => setCourse(r.data)),
      categoriesApi.list(courseId).then(r => setCats(r.data)),
    ]).catch(() => setError(t('common.error'))).finally(() => setDataLoading(false));
  };

  useEffect(() => { if (user && Number.isFinite(courseId)) reload(); /* eslint-disable-next-line */ }, [user, courseId]);

  // Load list of other courses (for the "copy from" dropdown)
  useEffect(() => {
    if (!user) return;
    coursesApi.list().then(r => setOtherCourses((r.data as CourseInfo[]).filter(c => c.course_id !== courseId)));
  }, [user, courseId]);

  const copyFrom = async () => {
    if (!copyFromId) return;
    setCopying(true);
    setError('');
    try {
      await categoriesApi.copyFrom(courseId, parseInt(copyFromId, 10));
      setCopyFromId('');
      reload();
    } catch (e: any) {
      setError(e.response?.data?.detail || t('common.error'));
    } finally {
      setCopying(false);
    }
  };

  const startCreate = () => { setEditing(null); setDraft({ ...emptyDraft, order_index: cats.length }); setFormOpen(true); };
  const startEdit = (c: Category) => {
    setEditing(c);
    setDraft({ name: c.name, max_value: String(c.max_value), kind: c.kind, order_index: c.order_index });
    setFormOpen(true);
  };
  const cancel = () => { setEditing(null); setDraft(emptyDraft); setFormOpen(false); };

  const save = async () => {
    setError('');
    const max = parseFloat(draft.max_value);
    if (!draft.name.trim() || !(max > 0)) { setError(t('common.error')); return; }
    setSaving(true);
    try {
      const payload = { name: draft.name.trim(), max_value: max, kind: draft.kind, order_index: draft.order_index };
      if (editing) await categoriesApi.update(courseId, editing.id, payload);
      else await categoriesApi.create(courseId, payload);
      cancel();
      reload();
    } catch (e: any) {
      setError(e.response?.status === 409 ? t('cat.duplicate') : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(t('cat.confirm_delete'))) return;
    await categoriesApi.delete(courseId, c.id);
    reload();
  };

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 };
  const inp = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const, background: 'var(--input-bg)', color: 'var(--fg)' };
  const btn = (bg: string, fg = '#fff') => ({
    background: bg, color: fg, border: 'none', borderRadius: 8,
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  });

  return (
    <DashboardLayout>
      <Breadcrumb crumbs={[
        { label: t('nav.courses'), href: '/dashboard/supervisor/courses' },
        { label: course?.title || '…' },
        { label: t('cat.title') },
      ]} />
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">{t('cat.title')}</h1>
        <p className="page-sub">{course ? course.title : '…'}</p>
        <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 6 }}>{t('cat.subtitle')}</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '12px 16px', color: '#F87171', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {otherCourses.length > 0 && (
        <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--fg-2)', fontSize: 13 }}>{t('cat.copy_from')}:</span>
          <select value={copyFromId} onChange={e => setCopyFromId(e.target.value)} style={inp}>
            <option value="">{t('cat.copy_pick')}</option>
            {otherCourses.map(c => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
          </select>
          <button onClick={copyFrom} disabled={!copyFromId || copying} style={{ ...btn('#0EA5E9'), opacity: (!copyFromId || copying) ? 0.5 : 1 }}>
            {copying ? t('common.loading') : t('cat.copy_btn')}
          </button>
          <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{t('cat.copy_hint')}</span>
        </div>
      )}

      <div style={{ ...card, marginBottom: 20 }}>
        {dataLoading ? (
          <p style={{ color: 'var(--fg-3)', fontSize: 14 }}>{t('common.loading')}</p>
        ) : cats.length === 0 ? (
          <p style={{ color: 'var(--fg-3)', fontSize: 14 }}>{t('cat.none')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[t('cat.order'), t('cat.name'), t('cat.max'), t('cat.kind'), t('common.actions')].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-3)' }}>{c.order_index}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg)', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-2)' }}>{c.max_value}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-2)' }}>{t(`cat.kind_${c.kind}`)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => startEdit(c)} style={btn('var(--surface-2)', 'var(--fg)')}>{t('common.edit')}</button>
                      <button onClick={() => remove(c)} style={btn('rgba(248,113,113,0.1)', '#F87171')}>{t('common.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!formOpen && (
        <button onClick={startCreate} style={btn('#0EA5E9')}>{t('cat.add')}</button>
      )}

      {formOpen && (
        <div style={{ ...card, marginTop: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', marginBottom: 16 }}>
            {editing ? t('common.edit') : t('cat.add')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 0.7fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('cat.name')}</label>
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('cat.max')}</label>
              <input type="number" min={0} step="any" value={draft.max_value} onChange={e => setDraft({ ...draft, max_value: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('cat.kind')}</label>
              <select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as Kind })} style={inp}>
                <option value="regular">{t('cat.kind_regular')}</option>
                <option value="weekly">{t('cat.kind_weekly')}</option>
                <option value="bonus">{t('cat.kind_bonus')}</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('cat.order')}</label>
              <input type="number" value={draft.order_index} onChange={e => setDraft({ ...draft, order_index: parseInt(e.target.value || '0', 10) })} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={save} disabled={saving} style={{ ...btn('#10B981'), opacity: saving ? 0.6 : 1 }}>{t('common.save')}</button>
            <button onClick={cancel} style={btn('var(--surface-2)', 'var(--fg)')}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
