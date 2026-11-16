'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { SkeletonTable } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';
import ConfirmModal from '@/components/ConfirmModal';
import EmptyState from '@/components/EmptyState';

interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

const roleColors: Record<string, string> = {
  admin: '#10B981', teacher: '#0EA5E9', supervisor: '#F59E0B',
};

const EMPTY_FORM = { first_name: '', last_name: '', email: '', password: '', role: 'teacher' };

export default function UsersPage() {
  const { user, loading } = useRequireRole('admin');
  const router = useRouter();
  const { t } = useT();
  const [users, setUsers] = useState<User[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; subject: string } | null>(null);
  const [error, setError] = useState('');
  const [inviteSent, setInviteSent] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role === 'admin') fetchUsers();
  }, [user]);

  const fetchUsers = () =>
    usersApi.list()
      .then(res => setUsers(res.data))
      .finally(() => setDataLoading(false));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) {
        const payload: Record<string, string> = { first_name: form.first_name, last_name: form.last_name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await usersApi.update(editId, payload);
        setShowForm(false);
        setForm(EMPTY_FORM);
        setEditId(null);
        fetchUsers();
      } else {
        const payload: Record<string, string> = { first_name: form.first_name, last_name: form.last_name, email: form.email, role: form.role };
        const res = await usersApi.create(payload);
        const newUserId: number = res.data.user_id;
        await usersApi.createInvite(newUserId);
        setInviteSent(newUserId);
        setTimeout(() => setInviteSent(null), 3000);
        fetchUsers();
        setForm(EMPTY_FORM);
        setShowForm(false);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
    }
  };

  const handleEdit = (u: User) => {
    setForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, password: '', role: u.role });
    setEditId(u.user_id);
    setShowForm(true);
    setConfirmDelete(null);
  };

  const handleDelete = async (id: number) => {
    try {
      await usersApi.delete(id);
      setConfirmDelete(null);
      fetchUsers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
      setConfirmDelete(null);
    }
  };

  const handleSendInvite = async (userId: number) => {
    try {
      await usersApi.createInvite(userId, true);
      setInviteSent(userId);
      setTimeout(() => setInviteSent(null), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
    }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg)', fontSize: 14, outline: 'none' };
  const labelStyle = { display: 'block' as const, fontSize: 11, fontWeight: 500 as const, color: 'var(--fg-2)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.06em' };

  if (loading || !user) return <DashboardLayout><SkeletonTable rows={6} cols={4} /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title">{t('users.title')}</h1>
          <p className="page-sub">{t('users.subtitle', { n: users.length })}</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError(''); }}
          style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {t('users.new_btn')}
        </button>
      </div>

      {error && <p style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}


      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, marginBottom: 28 }}>
          <h2 style={{ color: 'var(--fg)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editId ? t('users.edit') : t('users.new')}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>{t('common.first_name')}</label>
                <input style={inputStyle} value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div>
                <label style={labelStyle}>{t('common.last_name')}</label>
                <input style={inputStyle} value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
              </div>
              <div>
                <label style={labelStyle}>{t('common.email')}</label>
                <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label style={labelStyle}>{t('common.role')}</label>
                <select style={inputStyle} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="teacher">{t('role.teacher')}</option>
                  <option value="supervisor">{t('role.supervisor')}</option>
                  <option value="admin">{t('role.admin')}</option>
                </select>
              </div>
            </div>

            {/* On create: invite email is always sent automatically */}
            {!editId && (
              <p style={{ color: 'var(--fg-2)', fontSize: 13, padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.25)', marginBottom: 4 }}>
                📧 {t('users.invite_hint')}
              </p>
            )}

            {/* Password field on edit */}
            {editId && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{t('common.password')} <span style={{ textTransform: 'none', fontSize: 11, fontWeight: 400 }}>{t('users.password_hint')}</span></label>
                <input style={inputStyle} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {editId ? t('common.save_changes') : t('users.create_invite')}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {dataLoading ? <SkeletonTable rows={5} cols={4} /> : users.length === 0 ? (
        <EmptyState
          icon="👥"
          title={t('users.none')}
          description={t('users.none_desc')}
          action={{ label: t('users.new_btn'), onClick: () => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); setError(''); } }}
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {[t('common.name'), t('common.email'), t('common.role'), t('common.actions')].map(h => (
                  <th key={h} style={{ padding: '14px 20px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <td style={{ padding: '14px 20px', color: 'var(--fg)', fontSize: 14, textAlign: 'start' }}>{u.first_name} {u.last_name}</td>
                  <td style={{ padding: '14px 20px', color: 'var(--fg-2)', fontSize: 14, textAlign: 'start' }}>{u.email}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${roleColors[u.role]}18`, color: roleColors[u.role], border: `1px solid ${roleColors[u.role]}40`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t(`role.${u.role}`)}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button onClick={() => handleEdit(u)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer' }}>{t('common.edit')}</button>
                      {u.user_id !== user?.user_id && (
                        <>
                          <button onClick={() => handleSendInvite(u.user_id)}
                            style={{ padding: '5px 12px', background: inviteSent === u.user_id ? 'rgba(16,185,129,0.12)' : 'transparent', border: `1px solid ${inviteSent === u.user_id ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.5)'}`, borderRadius: 6, color: inviteSent === u.user_id ? '#10B981' : '#F59E0B', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>
                            {inviteSent === u.user_id ? t('users.reset_sent') : t('users.reset_password')}
                          </button>
                          <button onClick={() => setConfirmDelete({ id: u.user_id, subject: `${u.first_name} ${u.last_name} — ${u.email}` })} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#F87171', fontSize: 13, cursor: 'pointer' }}>{t('common.delete')}</button>
                        </>
                      )}
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
          messageKey='users.confirm_delete'
          subject={confirmDelete.subject}
          onConfirm={() => handleDelete(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </DashboardLayout>
  );
}
