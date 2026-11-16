'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { authApi } from '@/lib/api';
import { useT } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { t, dir } = useT();
  const token = typeof params.token === 'string' ? params.token : Array.isArray(params.token) ? params.token[0] : '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError(t('invite.mismatch')); return; }
    setSubmitting(true);
    try {
      await authApi.acceptInvite(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('invite.invalid'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--fg)', fontSize: 14, outline: 'none',
    boxSizing: 'border-box' as const,
  };
  const labelStyle = {
    display: 'block' as const, fontSize: 11, fontWeight: 600 as const,
    color: 'var(--fg-2)', marginBottom: 6,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  };

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'absolute', top: 20, right: 24 }}><LanguageSwitcher /></div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 44px', width: '100%', maxWidth: 440, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        {/* Logo / app name */}
        <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, color: '#10B981', marginBottom: 6, textAlign: 'center' }}>
          {t('app.name')}
        </p>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <p style={{ color: '#10B981', fontWeight: 600, fontSize: 15 }}>{t('invite.success')}</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--fg)', marginBottom: 8, textAlign: 'center' }}>
              {t('invite.title')}
            </h1>
            <p style={{ color: 'var(--fg-2)', fontSize: 13, marginBottom: 28, textAlign: 'center', lineHeight: 1.6 }}>
              {t('invite.subtitle')}
            </p>

            {error && <p style={{ color: '#F87171', fontSize: 13, marginBottom: 16, background: 'rgba(248,113,113,0.08)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.3)' }}>{error}</p>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={labelStyle}>{t('invite.new_password')}</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>{t('invite.confirm_password')}</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '12px', background: submitting ? 'var(--border)' : 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none', borderRadius: 10, color: submitting ? 'var(--fg-3)' : 'white',
                  fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                }}
              >
                {submitting ? t('invite.submitting') : t('invite.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
