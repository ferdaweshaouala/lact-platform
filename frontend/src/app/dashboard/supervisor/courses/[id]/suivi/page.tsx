'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { coursesApi, curriculumApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { useT } from '@/lib/i18n';

interface AbsentSession {
  session_id: number;
  title: string;
  followed_up: boolean;
  notes: string | null;
}

interface AbsentStudent {
  enrollment_id: number;
  student_name: string;
  student_number: string;
  phone_number: string | null;
  absent_sessions: AbsentSession[];
  followed_up: boolean; // all sessions followed up?
}

interface WeekData {
  week_number: number;
  total_sessions: number;
  recorded_sessions: number;
  absent_students: AbsentStudent[];
  status: 'not_started' | 'all_clear' | 'followed_up' | 'needs_action';
}

interface Course { course_id: number; title: string; }

const STATUS_CONFIG = {
  all_clear:    { color: '#10B981', bg: '#10B98115', border: '#10B98130', icon: '✓' },
  followed_up:  { color: '#0EA5E9', bg: '#0EA5E915', border: '#0EA5E930', icon: '✓' },
  needs_action: { color: '#F59E0B', bg: '#F59E0B15', border: '#F59E0B30', icon: '!' },
  not_started:  { color: '#64748B', bg: '#64748B10', border: '#64748B25', icon: '—' },
};

export default function SuiviPage() {
  const { user, loading } = useRequireRole('supervisor');
  const { t } = useT();
  const router = useRouter();
  const params = useParams();
  const courseId = parseInt(params.id as string);

  const [course, setCourse] = useState<Course | null>(null);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [toggling, setToggling] = useState<string | null>(null); // "sessionId-enrollmentId"
  const [fadingKeys, setFadingKeys] = useState<Set<string>>(new Set());   // "weekNum-enrollmentId" — showing تم التواصل
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set()); // hidden from table

  const fetchSuivi = useCallback(async () => {
    try {
      const [courseRes, suiviRes] = await Promise.all([
        coursesApi.get(courseId),
        curriculumApi.weeklySuivi(courseId),
      ]);
      setCourse(courseRes.data);
      setWeeks(suiviRes.data.weeks ?? []);
    } catch {
      // silently handle
    } finally {
      setDataLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (user?.role === 'supervisor') fetchSuivi();
  }, [user, fetchSuivi]);

  const handleToggle = async (weekNumber: number, sessionId: number, enrollmentId: number, currentValue: boolean) => {
    const toggleKey = `${sessionId}-${enrollmentId}`;
    const studentKey = `${weekNumber}-${enrollmentId}`;
    setToggling(toggleKey);
    try {
      await curriculumApi.toggleFollowUp(courseId, sessionId, enrollmentId, !currentValue);

      // Optimistic update — also detect if student is now fully done
      let studentNowDone = false;
      setWeeks(prev => prev.map(w => {
        if (w.week_number !== weekNumber) return w;
        const updatedStudents = w.absent_students.map(s => {
          if (s.enrollment_id !== enrollmentId) return s;
          const updatedSessions = s.absent_sessions.map(sess =>
            sess.session_id === sessionId ? { ...sess, followed_up: !currentValue } : sess
          );
          const allDone = updatedSessions.every(sess => sess.followed_up);
          if (allDone && !currentValue) studentNowDone = true;
          return { ...s, absent_sessions: updatedSessions, followed_up: allDone };
        });
        const needsAction = updatedStudents.some(s => !s.followed_up);
        const hasAbsent = updatedStudents.length > 0;
        let status = w.status;
        if (w.recorded_sessions === 0) status = 'not_started';
        else if (!hasAbsent) status = 'all_clear';
        else if (!needsAction) status = 'followed_up';
        else status = 'needs_action';
        return { ...w, absent_students: updatedStudents, status };
      }));

      // If student is fully done → flash confirmation banner then dismiss
      if (studentNowDone) {
        setFadingKeys(prev => new Set([...prev, studentKey]));
        setTimeout(() => {
          setFadingKeys(prev => { const n = new Set(prev); n.delete(studentKey); return n; });
          setDismissedKeys(prev => new Set([...prev, studentKey]));
        }, 3500);
      }
    } catch {
      fetchSuivi();
    } finally {
      setToggling(null);
    }
  };

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  const summaryStats = {
    total: weeks.length,
    allClear: weeks.filter(w => w.status === 'all_clear').length,
    followedUp: weeks.filter(w => w.status === 'followed_up').length,
    needsAction: weeks.filter(w => w.status === 'needs_action').length,
    notStarted: weeks.filter(w => w.status === 'not_started').length,
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← {t('common.cancel')}
        </button>
        <h1 className="page-title">{t('suivi.title')}</h1>
        <p className="page-sub">{course?.title ?? '…'} — {t('suivi.subtitle')}</p>
      </div>

      {dataLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="sk" style={{ height: 64, borderRadius: 12 }} />
          ))}
        </div>
      ) : weeks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="text-fg3" style={{ fontSize: 14 }}>{t('suivi.no_curriculum')}</p>
        </div>
      ) : (
        <>
          {/* Summary pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
            {[
              { label: t('suivi.all_clear'), count: summaryStats.allClear, color: '#10B981' },
              { label: t('suivi.followed_up'), count: summaryStats.followedUp, color: '#0EA5E9' },
              { label: t('suivi.needs_action'), count: summaryStats.needsAction, color: '#F59E0B' },
              { label: t('suivi.not_started'), count: summaryStats.notStarted, color: '#64748B' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 13, fontWeight: 600, color }}>{count}</span>
                <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, marginInlineStart: 'auto' }}>
              <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{summaryStats.total} {t('suivi.weeks_total')}</span>
            </div>
          </div>

          {/* Week list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {weeks.map(week => {
              const cfg = STATUS_CONFIG[week.status];
              const isExpanded = expandedWeek === week.week_number;
              const sessionsComplete = week.recorded_sessions === week.total_sessions && week.total_sessions > 0;

              return (
                <div key={week.week_number} style={{ border: `1px solid ${isExpanded ? cfg.color + '50' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>

                  {/* Week row header */}
                  <div
                    onClick={() => setExpandedWeek(isExpanded ? null : week.week_number)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', background: isExpanded ? cfg.bg : 'transparent', transition: 'background 0.2s', userSelect: 'none', borderBottom: isExpanded ? `1px solid ${cfg.border}` : 'none' }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                  >
                    {/* Status icon */}
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: cfg.bg, border: `1.5px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: cfg.color, fontSize: 14, fontWeight: 800 }}>{cfg.icon}</span>
                    </div>

                    {/* Week label + sessions bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <p className="text-fg" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                          {t('suivi.week', { n: String(week.week_number) })}
                        </p>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          {t(`suivi.${week.status}`)}
                        </span>
                      </div>
                      {/* Sessions progress mini-bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {Array.from({ length: week.total_sessions }, (_, i) => (
                            <div key={i} style={{ width: 16, height: 6, borderRadius: 3, background: i < week.recorded_sessions ? cfg.color : 'var(--border-soft)' }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                          {t('suivi.sessions', { done: String(week.recorded_sessions), total: String(week.total_sessions) })}
                        </span>
                      </div>
                    </div>

                    {/* Right side: chevron */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ padding: '16px 18px' }}>
                      {week.absent_students.length === 0 ? (
                        <p style={{ color: '#10B981', fontSize: 13, fontWeight: 500 }}>{t('suivi.no_absences')}</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {week.absent_students.map(student => {
                            const studentKey = `${week.week_number}-${student.enrollment_id}`;
                            const isFading = fadingKeys.has(studentKey);
                            const isDismissed = dismissedKeys.has(studentKey) || (student.followed_up && !isFading);
                            if (isDismissed) return null;
                            if (isFading) return (
                              <div key={student.enrollment_id}
                                style={{ borderRadius: 12, overflow: 'hidden', animation: 'fadeOutDown 0.6s ease 2.8s forwards' }}>
                                <style>{`@keyframes fadeOutDown { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(8px); } }`}</style>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'linear-gradient(135deg, #10B98118, #10B98108)', border: '1px solid #10B98140', borderRadius: 12 }}>
                                  {/* Big check circle */}
                                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#10B98120', border: '2px solid #10B98150', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: '#10B981', margin: 0 }}>{student.student_name}</p>
                                    <p style={{ fontSize: 12, color: '#059669', margin: '3px 0 0', fontWeight: 500 }}>{t('suivi.followed_badge')} — {t('suivi.all_sessions_done')}</p>
                                  </div>
                                  <span style={{ fontSize: 11, color: '#10B981', opacity: 0.7 }}>✓✓</span>
                                </div>
                              </div>
                            );
                            return (
                            <div key={student.enrollment_id}
                              style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '14px 16px' }}>

                              {/* Student header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div>
                                  <p className="text-fg" style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{student.student_name}</p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                                    <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'monospace' }}>{student.student_number}</span>
                                    {student.phone_number && (
                                      <a href={`tel:${student.phone_number}`} style={{ fontSize: 12, color: '#10B981', fontWeight: 600, textDecoration: 'none' }}>
                                        📞 {student.phone_number}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Absent sessions list */}
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                  {t('suivi.absent_in')}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {student.absent_sessions.map(sess => {
                                    const toggleKey = `${sess.session_id}-${student.enrollment_id}`;
                                    const isToggling = toggling === toggleKey;
                                    return (
                                      <div key={sess.session_id}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: sess.followed_up ? 'rgba(16,185,129,0.06)' : 'var(--surface-2)', borderRadius: 8, border: `1px solid ${sess.followed_up ? 'rgba(16,185,129,0.2)' : 'var(--border-soft)'}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                          <button
                                            onClick={() => handleToggle(week.week_number, sess.session_id, student.enrollment_id, sess.followed_up)}
                                            disabled={isToggling}
                                            style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${sess.followed_up ? '#10B981' : 'var(--border)'}`, background: sess.followed_up ? '#10B981' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', opacity: isToggling ? 0.5 : 1 }}>
                                            {sess.followed_up && (
                                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                              </svg>
                                            )}
                                          </button>
                                          <span style={{ fontSize: 12, color: 'var(--fg)', textDecoration: sess.followed_up ? 'line-through' : 'none', opacity: sess.followed_up ? 0.5 : 1 }}>
                                            {sess.title}
                                          </span>
                                        </div>
                                        {sess.followed_up && (
                                          <span style={{ fontSize: 11, fontWeight: 600, color: '#10B981', whiteSpace: 'nowrap' }}>
                                            {t('suivi.followed_badge')}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
