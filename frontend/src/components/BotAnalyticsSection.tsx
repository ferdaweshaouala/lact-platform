'use client';
import { useEffect, useState } from 'react';
import { analyticsApi } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface SubData  { total: number; graded: number; ungraded: number; by_course: { title: string; graded: number; ungraded: number }[] }
interface CompData { total: number; pending: number; accepted: number; rejected: number; by_course: { title: string; pending: number; accepted: number; rejected: number }[] }

const COMP_COLORS = { pending: '#F59E0B', accepted: '#10B981', rejected: '#F87171' };

type TTEntry = { name: string; value: number | string; color?: string; fill?: string };
const TT = ({ active, payload, label }: { active?: boolean; payload?: TTEntry[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill || p.color || 'var(--fg)', margin: '2px 0' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8 }}>
    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <p style={{ fontSize: 13, color: 'var(--fg-3)', textAlign: 'center' }}>{label}</p>
  </div>
);

interface Props {
  role: 'admin' | 'supervisor' | 'teacher';
  t: (key: string) => string;
  isRtl?: boolean;
}

export default function BotAnalyticsSection({ role, t, isRtl }: Props) {
  const [subData, setSubData]   = useState<SubData | null>(null);
  const [compData, setCompData] = useState<CompData | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.botSubmissions().then(r => setSubData(r.data)).catch(() => {}),
      analyticsApi.botCompensation().then(r => setCompData(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const compPieData = compData ? [
    { name: t('bot.pending'),  value: compData.pending,  color: COMP_COLORS.pending },
    { name: t('bot.accepted'), value: compData.accepted, color: COMP_COLORS.accepted },
    { name: t('bot.rejected'), value: compData.rejected, color: COMP_COLORS.rejected },
  ].filter(d => d.value > 0) : [];

  const sectionTitle = (title: string, accent: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <div style={{ width: 4, height: 18, borderRadius: 2, background: accent }} />
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', fontFamily: "'Syne', sans-serif" }}>{title}</h3>
    </div>
  );

  const kpi = (label: string, value: number, accent: string) => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', borderInlineStart: `4px solid ${accent}` }}>
      <p style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: accent, fontFamily: "'Syne', sans-serif" }}>{loading ? '—' : value}</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 32 }}>

      {/* Section divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          {t('bot.section_title')}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {kpi(t('bot.total_submissions'), subData?.total ?? 0, '#8B5CF6')}
        {kpi(t('bot.ungraded'),          subData?.ungraded ?? 0, '#F59E0B')}
        {kpi(t('bot.pending_requests'),  compData?.pending ?? 0, '#0EA5E9')}
        {role !== 'teacher' && kpi(t('bot.total_requests'), compData?.total ?? 0, '#10B981')}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: subData?.by_course.length ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* Submissions per course */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          {sectionTitle(t('bot.submissions_by_course'), '#8B5CF6')}
          {loading ? (
            <div style={{ height: 200, background: 'var(--sk-color)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
          ) : !subData?.by_course.length ? (
            <EmptyState label={t('bot.no_submissions_yet')} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subData.by_course} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--fg-3)' }} />
                <YAxis type="category" dataKey="title" tick={{ fontSize: 11, fill: 'var(--fg-2)' }} width={120} />
                <Tooltip content={<TT />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="graded"   name={t('bot.graded')}   fill="#10B981" radius={[0, 4, 4, 0]} stackId="a" />
                <Bar dataKey="ungraded" name={t('bot.ungraded')} fill="#F59E0B" radius={[0, 4, 4, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Compensation requests donut */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          {sectionTitle(t('bot.compensation_by_status'), '#0EA5E9')}
          {loading ? (
            <div style={{ height: 200, background: 'var(--sk-color)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
          ) : !compPieData.length ? (
            <EmptyState label={t('bot.no_requests_yet')} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={compPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {compPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<TT />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

      {/* Per-course compensation breakdown — supervisor & admin only */}
      {role !== 'teacher' && compData && compData.by_course.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
          {sectionTitle(t('bot.compensation_by_course'), '#10B981')}
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compData.by_course} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--fg-3)' }} />
              <YAxis type="category" dataKey="title" tick={{ fontSize: 11, fill: 'var(--fg-2)' }} width={120} />
              <Tooltip content={<TT />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pending"  name={t('bot.pending')}  fill={COMP_COLORS.pending}  radius={[0, 4, 4, 0]} stackId="a" />
              <Bar dataKey="accepted" name={t('bot.accepted')} fill={COMP_COLORS.accepted} radius={[0, 4, 4, 0]} stackId="a" />
              <Bar dataKey="rejected" name={t('bot.rejected')} fill={COMP_COLORS.rejected} radius={[0, 4, 4, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
