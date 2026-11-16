'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { coursesApi, predictionApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { useT } from '@/lib/i18n';

interface Features {
  att_rate: number;
  att_trend: number;
  grade_avg: number;
  submission_rate: number;
  late_att_drop: number;
  [key: string]: number;
}

interface RiskEntry {
  student_id: number;
  student_name: string;
  dropout_probability: number | null;
  risk_label: 'high' | 'medium' | 'low' | 'insufficient_data';
  threshold_used: number;
  features?: Features;
}

interface Course { course_id: number; title: string; }

const RISK_COLORS = {
  high:              { color: '#EF4444', bg: '#EF444415', border: '#EF444430' },
  medium:            { color: '#F59E0B', bg: '#F59E0B15', border: '#F59E0B30' },
  low:               { color: '#10B981', bg: '#10B98115', border: '#10B98130' },
  insufficient_data: { color: '#64748B', bg: '#64748B10', border: '#64748B25' },
};

const RiskIcon = ({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) => {
  const iconPath = label === 'high'
    ? 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01'
    : label === 'medium'
    ? 'M12 8v4m0 4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z'
    : label === 'low'
    ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    : 'M5 12h14';
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
    </div>
  );
};

const ModelInfoIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
  </svg>
);

// ── Feature signal chips ──────────────────────────────────────────────────────

type SignalVariant = 'danger' | 'warning' | 'good' | 'neutral';

const VARIANT_STYLES: Record<SignalVariant, { color: string; bg: string; border: string }> = {
  danger:  { color: '#EF4444', bg: '#EF444412', border: '#EF444430' },
  warning: { color: '#F59E0B', bg: '#F59E0B12', border: '#F59E0B30' },
  good:    { color: '#10B981', bg: '#10B98112', border: '#10B98130' },
  neutral: { color: '#64748B', bg: '#64748B10', border: '#64748B25' },
};

function Chip({ label, value, variant }: { label: string; value: string; variant: SignalVariant }) {
  const s = VARIANT_STYLES[variant];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, border: `1px solid ${s.border}`, color: s.color, whiteSpace: 'nowrap' }}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

function FeatureSignals({ f, t }: { f: Features; t: (k: string) => string }) {
  const chips: { label: string; value: string; variant: SignalVariant }[] = [];

  // Attendance rate
  const attPct = Math.round(f.att_rate * 100);
  chips.push({
    label: t('risk.signal_att'),
    value: `${attPct}%`,
    variant: attPct >= 75 ? 'good' : attPct >= 50 ? 'warning' : 'danger',
  });

  // Grade average
  const gradePct = Math.round(f.grade_avg * 100);
  chips.push({
    label: t('risk.signal_grade'),
    value: `${gradePct}%`,
    variant: gradePct >= 70 ? 'good' : gradePct >= 45 ? 'warning' : 'danger',
  });

  // Submission rate
  const subPct = Math.round(f.submission_rate * 100);
  if (subPct === 0) {
    chips.push({ label: t('risk.signal_no_submissions'), value: '', variant: 'danger' });
  } else {
    chips.push({
      label: t('risk.signal_submissions'),
      value: `${subPct}%`,
      variant: subPct >= 70 ? 'good' : subPct >= 40 ? 'warning' : 'danger',
    });
  }

  // Attendance trend
  if (f.att_trend < -0.2) {
    chips.push({ label: t('risk.signal_trend_falling'), value: '', variant: 'danger' });
  } else if (f.att_trend > 0.2) {
    chips.push({ label: t('risk.signal_trend_rising'), value: '', variant: 'good' });
  }

  // Late attendance drop
  if (f.late_att_drop === 1) {
    chips.push({ label: t('risk.signal_late_drop'), value: '', variant: 'danger' });
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {chips.map((c, i) => (
        <Chip key={i} label={c.label} value={c.value} variant={c.variant} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CourseRiskPage() {
  const { user, loading } = useRequireRole('supervisor');
  const { t } = useT();
  const router = useRouter();
  const params = useParams();
  const courseId = parseInt(params.id as string);

  const [course, setCourse]   = useState<Course | null>(null);
  const [entries, setEntries] = useState<RiskEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchRisk = useCallback(async () => {
    setDataLoading(true);
    setError(null);
    try {
      const [courseRes, riskRes] = await Promise.all([
        coursesApi.get(courseId),
        predictionApi.courseRisk(courseId),
      ]);
      setCourse(courseRes.data);
      setEntries(riskRes.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || t('risk.load_error'));
    } finally {
      setDataLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    if (user?.role === 'supervisor') fetchRisk();
  }, [user, fetchRisk]);

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  const counts = {
    high:    entries.filter(e => e.risk_label === 'high').length,
    medium:  entries.filter(e => e.risk_label === 'medium').length,
    low:     entries.filter(e => e.risk_label === 'low').length,
    no_data: entries.filter(e => e.risk_label === 'insufficient_data').length,
  };

  const RISK_LABEL_KEYS: Record<string, string> = {
    high: 'risk.high', medium: 'risk.medium',
    low: 'risk.low', insufficient_data: 'risk.no_data',
  };

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {t('risk.back')}
        </button>
        <h1 className="page-title">{t('risk.title')}</h1>
        <p className="page-sub">{course?.title ?? '…'} — {t('risk.subtitle')}</p>
      </div>

      {dataLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="sk" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#EF4444', fontSize: 14 }}>{error}</p>
          <button onClick={fetchRisk} className="btn-primary" style={{ marginTop: 12 }}>{t('risk.retry')}</button>
        </div>
      ) : (
        <>
          {/* Summary pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
            {[
              { key: 'risk.high',    count: counts.high,    color: RISK_COLORS.high.color },
              { key: 'risk.medium',  count: counts.medium,  color: RISK_COLORS.medium.color },
              { key: 'risk.low',     count: counts.low,     color: RISK_COLORS.low.color },
              { key: 'risk.no_data', count: counts.no_data, color: RISK_COLORS.insufficient_data.color },
            ].map(({ key, count, color }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{count}</span>
                <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{t(key)}</span>
              </div>
            ))}
            <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20 }}>
              <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{t('risk.students_total', { n: entries.length })}</span>
            </div>
          </div>

          {/* Model info banner */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', background: '#0EA5E908', border: '1px solid #0EA5E920', borderRadius: 12, marginBottom: 20 }}>
            <ModelInfoIcon />
            <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: 0 }}>
              {t('risk.model_info')} <strong>0.702</strong>
            </p>
          </div>

          {/* Student list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map(entry => {
              const cfg = RISK_COLORS[entry.risk_label];
              const pct = entry.dropout_probability !== null ? Math.round(entry.dropout_probability * 100) : null;

              return (
                <div
                  key={entry.student_id}
                  style={{ padding: '14px 18px', background: 'var(--surface)', border: `1px solid ${entry.risk_label === 'high' ? '#EF444430' : 'var(--border)'}`, borderRadius: 14 }}
                >
                  {/* Top row: icon + name + bar + arrow */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                    onClick={() => router.push(`/dashboard/supervisor/students/${entry.student_id}`)}
                  >
                    <RiskIcon label={entry.risk_label} {...cfg} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-fg" style={{ fontSize: 14, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.student_name}
                      </p>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, padding: '1px 7px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8 }}>
                        {t(RISK_LABEL_KEYS[entry.risk_label])}
                      </span>
                    </div>

                    {pct !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <div style={{ width: 120, height: 6, background: 'var(--border-soft)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--fg-3)', flexShrink: 0 }}>{t('risk.needs_more')}</span>
                    )}

                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>

                  {/* Feature signal chips */}
                  {entry.features && (
                    <FeatureSignals f={entry.features} t={t} />
                  )}
                </div>
              );
            })}
          </div>

          {entries.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p className="text-fg3" style={{ fontSize: 14 }}>{t('risk.none')}</p>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
