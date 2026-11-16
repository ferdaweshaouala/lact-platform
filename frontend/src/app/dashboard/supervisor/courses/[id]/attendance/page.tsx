'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRequireRole } from '@/hooks/useRequireRole';
import { attendanceApi, coursesApi, curriculumApi, notesApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumb from '@/components/Breadcrumb';
import { useT } from '@/lib/i18n';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type Status = 'present' | 'absent' | 'makeup';
type Mode = 'date' | 'curriculum';

interface RosterRow {
  enrollment_id: number; student_id: number;
  first_name: string; last_name: string; student_number: string;
  status: Status | null; notes: string | null;
}

interface CurriculumSession {
  id: number;
  week_number: number;
  session_type: 'lecture' | 'workshop';
  title: string;
  order_index: number;
  has_records: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function AttendancePage() {
  const { user, loading } = useRequireRole(['supervisor', 'admin', 'teacher']);
  const { t } = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = parseInt(params.id, 10);

  const [course, setCourse] = useState<{ course_id: number; title: string } | null>(null);
  const [mode, setMode] = useState<Mode>('date');

  // ── Date mode state ──────────────────────────────────────────────
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [recentSessions, setRecentSessions] = useState<{ session_date: string; records: number }[]>([]);
  const [trendData, setTrendData] = useState<{ date: string; present: number; absent: number; makeup: number }[]>([]);

  // ── Curriculum mode state ────────────────────────────────────────
  const [currSessions, setCurrSessions] = useState<CurriculumSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [currRoster, setCurrRoster] = useState<RosterRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newWeek, setNewWeek] = useState(1);
  const [newType, setNewType] = useState<'lecture' | 'workshop'>('lecture');
  // PDF upload state
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ week_number: number; session_type: string; title: string; order_index: number }[] | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // ── Session report state ─────────────────────────────────────────
  const [showNotePanel, setShowNotePanel] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteSending, setNoteSending] = useState(false);
  const [noteSent, setNoteSent] = useState(false);
  const [lastSaveStats, setLastSaveStats] = useState<{
    present: number; absent: number; makeup: number;
    sessionTitle: string; weekNumber: number; sessionType: string;
    sessionId: number;
  } | null>(null);

  // ── Shared state ─────────────────────────────────────────────────
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const refreshTrend = useCallback(() => {
    if (!user || !Number.isFinite(courseId)) return;
    attendanceApi.trend(courseId).then(r => setTrendData(r.data)).catch(() => {});
  }, [user, courseId]);

  useEffect(() => {
    if (!user || !Number.isFinite(courseId)) return;
    coursesApi.get(courseId).then(r => setCourse(r.data)).catch(() => setError(t('common.error')));
    attendanceApi.sessions(courseId).then(r => setRecentSessions(r.data.sessions || [])).catch(() => {});
    refreshTrend();
  }, [user, courseId, t, refreshTrend]);

  // Load date-mode roster
  useEffect(() => {
    if (!user || !Number.isFinite(courseId) || mode !== 'date') return;
    setPageLoading(true);
    setInfo('');
    attendanceApi.forDate(courseId, sessionDate)
      .then(r => setRoster(r.data.roster || []))
      .catch(() => setError(t('common.error')))
      .finally(() => setPageLoading(false));
  }, [user, courseId, sessionDate, mode, t]);

  // Load curriculum sessions (has_records comes from the API)
  const loadCurrSessions = useCallback(() => {
    if (!user || !Number.isFinite(courseId)) return;
    curriculumApi.list(courseId)
      .then(r => setCurrSessions(r.data))
      .catch(() => {});
  }, [user, courseId]);

  useEffect(() => {
    if (mode === 'curriculum') {
      loadCurrSessions();
      setPageLoading(false);
    }
  }, [mode, loadCurrSessions]);

  // Load curriculum attendance when a session is selected
  useEffect(() => {
    if (selectedSessionId === null || mode !== 'curriculum') return;
    setPageLoading(true);
    setInfo('');
    curriculumApi.getAttendance(courseId, selectedSessionId)
      .then(r => setCurrRoster(r.data.roster || []))
      .catch(() => setError(t('common.error')))
      .finally(() => setPageLoading(false));
  }, [courseId, selectedSessionId, mode, t]);

  const setStatus = (enrollmentId: number, status: Status, target: 'date' | 'curriculum') => {
    const setter = target === 'date' ? setRoster : setCurrRoster;
    setter(prev => prev.map(r => r.enrollment_id === enrollmentId ? { ...r, status } : r));
  };

  const setAllPresent = (target: 'date' | 'curriculum') => {
    const setter = target === 'date' ? setRoster : setCurrRoster;
    setter(prev => prev.map(r => ({ ...r, status: 'present' as Status })));
  };

  const saveDate = async () => {
    setError(''); setInfo(''); setSaving(true);
    try {
      const records = roster.filter(r => r.status !== null)
        .map(r => ({ enrollment_id: r.enrollment_id, status: r.status as Status, notes: r.notes }));
      const res = await attendanceApi.save(courseId, sessionDate, records);
      setInfo(t('att.saved', { n: res.data.saved }));
      setRoster(prev => prev.map(r => ({ ...r, status: null, notes: null })));
      attendanceApi.sessions(courseId).then(r => setRecentSessions(r.data.sessions || []));
      refreshTrend();
    } catch (e: any) {
      setError(e.response?.data?.detail || t('common.error'));
    } finally { setSaving(false); }
  };

  const saveCurriculum = async () => {
    if (selectedSessionId === null) return;
    setError(''); setInfo(''); setSaving(true);
    try {
      const records = currRoster.filter(r => r.status !== null)
        .map(r => ({ enrollment_id: r.enrollment_id, status: r.status as Status, notes: r.notes }));

      // Capture stats before clearing roster
      const presentCount = currRoster.filter(r => r.status === 'present').length;
      const absentCount = currRoster.filter(r => r.status === 'absent').length;
      const makeupCount = currRoster.filter(r => r.status === 'makeup').length;
      const sel = currSessions.find(s => s.id === selectedSessionId);

      const res = await curriculumApi.saveAttendance(courseId, selectedSessionId, records);
      setInfo(t('att.saved', { n: res.data.saved }));
      setCurrRoster(prev => prev.map(r => ({ ...r, status: null, notes: null })));
      loadCurrSessions();

      // Show report panel
      if (sel) {
        setLastSaveStats({
          present: presentCount, absent: absentCount, makeup: makeupCount,
          sessionTitle: sel.title, weekNumber: sel.week_number,
          sessionType: sel.session_type, sessionId: selectedSessionId,
        });
        setNoteContent('');
        setNoteSent(false);
        setShowNotePanel(true);
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || t('common.error'));
    } finally { setSaving(false); }
  };

  const sendSessionReport = async () => {
    if (!lastSaveStats || !noteContent.trim()) return;
    setNoteSending(true);
    try {
      const stats = lastSaveStats;
      const total = stats.present + stats.absent + stats.makeup;
      const header = `📋 ${t('att.session_report')} — ${stats.sessionTitle}\n${t('cur.week')} ${stats.weekNumber} · ${stats.sessionType === 'lecture' ? t('cur.lecture') : t('cur.workshop')}\n\n`;
      const statLine = `👥 ${t('att.present')}: ${stats.present}/${total}  |  ${t('att.absent')}: ${stats.absent}  |  ${t('att.makeup')}: ${stats.makeup}\n\n`;
      const fullContent = header + statLine + noteContent.trim();
      await notesApi.create(courseId, fullContent, stats.sessionId);
      setNoteSent(true);
      setTimeout(() => setShowNotePanel(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.detail || t('common.error'));
    } finally { setNoteSending(false); }
  };

  const handleImportTemplate = async () => {
    if (!confirm(t('cur.import_confirm'))) return;
    setImporting(true);
    setError('');
    try {
      const res = await curriculumApi.importTemplate(courseId);
      setInfo(t('cur.imported', { n: res.data.created }));
      loadCurrSessions();
      setSelectedSessionId(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || t('common.error'));
    } finally { setImporting(false); }
  };

  const handleAddSession = async () => {
    if (!newTitle.trim()) return;
    try {
      await curriculumApi.create(courseId, {
        title: newTitle.trim(),
        week_number: newWeek,
        session_type: newType,
        order_index: currSessions.length + 1,
      });
      setShowAddForm(false);
      setNewTitle('');
      setNewWeek(1);
      setNewType('lecture');
      loadCurrSessions();
    } catch (e: any) {
      setError(e.response?.data?.detail || t('common.error'));
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm(t('cur.delete_confirm'))) return;
    try {
      await curriculumApi.delete(courseId, sessionId);
      if (selectedSessionId === sessionId) setSelectedSessionId(null);
      loadCurrSessions();
    } catch (e: any) {
      setError(e.response?.data?.detail || t('common.error'));
    }
  };

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setPdfUploading(true);
    setError('');
    try {
      const res = await curriculumApi.parsePdf(courseId, file);
      setPdfPreview(res.data.sessions);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('common.error'));
      setPdfFile(null);
    } finally {
      setPdfUploading(false);
      // Reset input so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const handlePdfImportConfirm = async () => {
    if (!pdfFile || !pdfPreview) return;
    setImporting(true);
    setError('');
    try {
      const res = await curriculumApi.importPdf(courseId, pdfFile);
      setInfo(t('cur.import_success', { n: res.data.created }));
      setPdfPreview(null);
      setPdfFile(null);
      setSelectedSessionId(null);
      loadCurrSessions();
    } catch (err: any) {
      setError(err.response?.data?.detail || t('common.error'));
    } finally {
      setImporting(false);
    }
  };

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 };
  const inp = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--input-bg)', color: 'var(--fg)' };
  const pill = (active: boolean, color: string) => ({
    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? `${color}18` : 'var(--surface)',
    color: active ? color : 'var(--fg-3)',
  });

  // Group curriculum sessions by week
  const sessionsByWeek = currSessions.reduce<Record<number, CurriculumSession[]>>((acc, s) => {
    (acc[s.week_number] = acc[s.week_number] || []).push(s);
    return acc;
  }, {});
  const weeks = Object.keys(sessionsByWeek).map(Number).sort((a, b) => a - b);

  const selectedSession = currSessions.find(s => s.id === selectedSessionId);
  const activeRoster = mode === 'date' ? roster : currRoster;
  const activeSave = mode === 'date' ? saveDate : saveCurriculum;

  return (
    <DashboardLayout>
      <Breadcrumb crumbs={[
        { label: t('nav.courses'), href: user.role === 'teacher' ? '/dashboard/teacher/courses' : '/dashboard/supervisor/courses' },
        { label: course?.title || '…' },
        { label: t('att.title') },
      ]} />

      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">{t('att.title')}</h1>
        <p className="page-sub">{course?.title || '…'}</p>
      </div>

      {error && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {info && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 14px', color: '#10B981', fontSize: 13, marginBottom: 12 }}>{info}</div>}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['date', 'curriculum'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(''); setInfo(''); }}
            style={{
              padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${mode === m ? '#0EA5E9' : 'var(--border)'}`,
              background: mode === m ? '#0EA5E918' : 'var(--surface)',
              color: mode === m ? '#0EA5E9' : 'var(--fg-2)',
            }}
          >
            {m === 'date' ? t('cur.by_date') : t('cur.by_session')}
          </button>
        ))}
      </div>

      {/* ── DATE MODE ── */}
      {mode === 'date' && (
        <>
          <div style={{ ...card, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--fg-2)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('att.session_date')}</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} style={inp} />
            </div>
            <button onClick={() => setAllPresent('date')} style={{ ...inp, marginTop: 18, cursor: 'pointer', background: 'var(--surface-2)', fontWeight: 600 }}>
              {t('att.mark_all_present')}
            </button>
            <button onClick={saveDate} disabled={saving} style={{ marginTop: 18, padding: '8px 20px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>

          <RosterTable roster={roster} pageLoading={pageLoading} t={t} pill={pill} onStatus={(id, s) => setStatus(id, s, 'date')} />

          {recentSessions.length > 0 && (
            <div style={{ ...card, marginTop: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', marginBottom: 10 }}>{t('att.recent_sessions')}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {recentSessions.map(s => (
                  <button key={s.session_date} onClick={() => setSessionDate(s.session_date)}
                    style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, background: s.session_date === sessionDate ? '#0EA5E9' : 'var(--surface-2)', color: s.session_date === sessionDate ? '#fff' : 'var(--fg-2)', cursor: 'pointer' }}>
                    {s.session_date} <span style={{ opacity: 0.7, marginInlineStart: 4 }}>({s.records})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attendance trend chart — only shows when there is more than one session */}
          {trendData.length > 1 && (
            <div style={{ ...card, marginTop: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>{t('att.trend_title')}</h2>
              <p style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 16 }}>{t('att.trend_sub')}</p>
              <div dir="ltr">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 4, right: 16, left: -20, bottom: 4 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--fg-2)' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--fg-2)' }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="present" name={t('att.present')} stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="absent" name={t('att.absent')} stroke="#F87171" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="makeup" name={t('att.makeup')} stroke="#0EA5E9" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── CURRICULUM MODE ── */}
      {mode === 'curriculum' && (
        <>
        {/* PDF Preview modal */}
        {pdfPreview && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>{t('cur.preview_title')}</h2>
                <p style={{ fontSize: 13, color: 'var(--fg-2)', margin: '6px 0 0' }}>
                  {pdfPreview.length === 0
                    ? t('cur.preview_none')
                    : t('cur.preview_sub', { n: pdfPreview.length })}
                </p>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {pdfPreview.length === 0 ? (
                  <p style={{ padding: 24, color: 'var(--fg-3)', fontSize: 14 }}>{t('cur.preview_none')}</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 16px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase' }}>{t('cur.session_week')}</th>
                        <th style={{ padding: '8px 16px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase' }}>{t('cur.session_type')}</th>
                        <th style={{ padding: '8px 16px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase' }}>{t('cur.session_title')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfPreview.map((s, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                          <td style={{ padding: '8px 16px', color: 'var(--fg-2)' }}>{s.week_number}</td>
                          <td style={{ padding: '8px 16px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                              background: s.session_type === 'lecture' ? '#8B5CF615' : '#F59E0B15',
                              color: s.session_type === 'lecture' ? '#8B5CF6' : '#F59E0B',
                            }}>
                              {s.session_type === 'lecture' ? t('cur.lecture') : t('cur.workshop')}
                            </span>
                          </td>
                          <td style={{ padding: '8px 16px', color: 'var(--fg)', fontWeight: 500 }}>{s.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setPdfPreview(null); setPdfFile(null); }}
                  style={{ padding: '8px 20px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fg)' }}
                >
                  {t('cur.preview_cancel')}
                </button>
                {pdfPreview.length > 0 && (
                  <button
                    onClick={handlePdfImportConfirm}
                    disabled={importing}
                    style={{ padding: '8px 20px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1 }}
                  >
                    {importing ? t('common.loading') : t('cur.preview_confirm', { n: pdfPreview.length })}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Left: session list */}
          <div>
            {/* Actions */}
            {['supervisor', 'admin'].includes(user.role) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {/* PDF upload */}
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 10px', background: '#8B5CF6', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: pdfUploading ? 'not-allowed' : 'pointer',
                  opacity: pdfUploading ? 0.6 : 1,
                }}>
                  <input type="file" accept=".pdf" onChange={handlePdfSelect} style={{ display: 'none' }} disabled={pdfUploading} />
                  {pdfUploading ? t('cur.uploading') : t('cur.upload_pdf')}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleImportTemplate}
                    disabled={importing}
                    style={{ flex: 1, padding: '8px 10px', background: '#0EA5E9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1 }}
                  >
                    {importing ? t('common.loading') : t('cur.import_template')}
                  </button>
                  <button
                    onClick={() => setShowAddForm(v => !v)}
                    style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fg)' }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Add form */}
            {showAddForm && (
              <div style={{ ...card, padding: 14, marginBottom: 12 }}>
                <input
                  placeholder={t('cur.session_title')}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{ ...inp, width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select value={newType} onChange={e => setNewType(e.target.value as 'lecture' | 'workshop')} style={inp}>
                    <option value="lecture">{t('cur.lecture')}</option>
                    <option value="workshop">{t('cur.workshop')}</option>
                  </select>
                  <input type="number" min={1} max={52} value={newWeek} onChange={e => setNewWeek(parseInt(e.target.value))} style={inp} placeholder={t('cur.week')} />
                </div>
                <button onClick={handleAddSession} style={{ width: '100%', padding: '7px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {t('cur.add_session')}
                </button>
              </div>
            )}

            {/* Session list */}
            {currSessions.length === 0 ? (
              <div style={{ ...card, padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
                {t('cur.no_sessions')}
              </div>
            ) : (
              <div style={{ ...card, padding: 0, overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
                {weeks.map(w => (
                  <div key={w}>
                    <div style={{ padding: '8px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t('cur.week')} {w}
                    </div>
                    {sessionsByWeek[w].map(s => {
                      const isSelected = selectedSessionId === s.id;
                      const isRecorded = s.has_records;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSessionId(s.id)}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)',
                            background: isSelected ? '#0EA5E918' : 'transparent',
                            borderInlineStart: isSelected ? '3px solid #0EA5E9' : '3px solid transparent',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                                background: s.session_type === 'lecture' ? '#8B5CF615' : '#F59E0B15',
                                color: s.session_type === 'lecture' ? '#8B5CF6' : '#F59E0B',
                                border: `1px solid ${s.session_type === 'lecture' ? '#8B5CF640' : '#F59E0B40'}`,
                              }}>
                                {s.session_type === 'lecture' ? t('cur.lecture') : t('cur.workshop')}
                              </span>
                              {isRecorded && <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>✓</span>}
                            </div>
                          </div>
                          {['supervisor', 'admin'].includes(user.role) && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteSession(s.id); }}
                              style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: 'var(--fg-3)', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}
                            >×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: roster for selected session */}
          <div>
            {selectedSessionId === null ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14, padding: 40 }}>
                {t('cur.select_session')}
              </div>
            ) : (
              <>
                <div style={{ ...card, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>{selectedSession?.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: 0, marginTop: 2 }}>
                      {t('cur.week')} {selectedSession?.week_number} · {selectedSession?.session_type === 'lecture' ? t('cur.lecture') : t('cur.workshop')}
                    </p>
                  </div>
                  <button onClick={() => setAllPresent('curriculum')} style={{ ...inp, cursor: 'pointer', background: 'var(--surface-2)', fontWeight: 600 }}>
                    {t('att.mark_all_present')}
                  </button>
                  <button onClick={saveCurriculum} disabled={saving} style={{ padding: '8px 20px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? t('common.loading') : t('common.save')}
                  </button>
                </div>

                <RosterTable roster={currRoster} pageLoading={pageLoading} t={t} pill={pill} onStatus={(id, s) => setStatus(id, s, 'curriculum')} />

                {/* ── Session Report Panel ── */}
                {showNotePanel && lastSaveStats && (
                  <div style={{ marginTop: 16, borderRadius: 14, border: noteSent ? '1px solid #10B98140' : '1px solid #0EA5E940', background: noteSent ? 'linear-gradient(135deg,#10B98108,#10B98104)' : 'linear-gradient(135deg,#0EA5E908,#0EA5E904)', padding: 20 }}>
                    {noteSent ? (
                      /* Sent confirmation */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#10B98120', border: '2px solid #10B98150', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#10B981', margin: 0 }}>{t('att.report_sent')}</p>
                          <p style={{ fontSize: 12, color: '#059669', margin: '3px 0 0', fontWeight: 500 }}>{t('att.report_sent_sub')}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                          <div>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>
                              📋 {t('att.session_report')}
                            </h3>
                            <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: '4px 0 0' }}>
                              {user.role === 'supervisor' ? t('att.session_report_sub_to_teacher') : t('att.session_report_sub')}
                            </p>
                          </div>
                          <button onClick={() => setShowNotePanel(false)} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
                        </div>

                        {/* Attendance stats strip */}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                          {[
                            { label: t('att.present'), val: lastSaveStats.present, color: '#10B981', bg: '#10B98115' },
                            { label: t('att.absent'), val: lastSaveStats.absent, color: '#F87171', bg: '#F8717115' },
                            { label: t('att.makeup'), val: lastSaveStats.makeup, color: '#0EA5E9', bg: '#0EA5E915' },
                          ].map(stat => (
                            <div key={stat.label} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: stat.bg, border: `1px solid ${stat.color}30` }}>
                              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.val}</div>
                              <div style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 600, marginTop: 2 }}>{stat.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Text area */}
                        <textarea
                          value={noteContent}
                          onChange={e => setNoteContent(e.target.value)}
                          placeholder={t('att.report_placeholder')}
                          rows={4}
                          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, background: 'var(--input-bg)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, fontFamily: 'inherit' }}
                        />

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setShowNotePanel(false)}
                            style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-2)' }}
                          >
                            {t('att.skip_report')}
                          </button>
                          <button
                            onClick={sendSessionReport}
                            disabled={noteSending || !noteContent.trim()}
                            style={{ padding: '8px 20px', background: noteContent.trim() ? '#0EA5E9' : 'var(--border)', color: noteContent.trim() ? '#fff' : 'var(--fg-3)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: noteSending || !noteContent.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 7 }}
                          >
                            {noteSending ? (
                              <>{t('common.loading')}</>
                            ) : (
                              <>
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                {user.role === 'supervisor' ? t('att.send_report_to_teacher') : t('att.send_report')}
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        </>
      )}
    </DashboardLayout>
  );
}

// ── Shared roster table component ─────────────────────────────────────────────

function RosterTable({
  roster, pageLoading, t, pill, onStatus,
}: {
  roster: { enrollment_id: number; first_name: string; last_name: string; student_number: string; status: string | null; notes: string | null }[];
  pageLoading: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  pill: (active: boolean, color: string) => React.CSSProperties;
  onStatus: (id: number, status: 'present' | 'absent' | 'makeup') => void;
}) {
  const statusColors: Record<string, string> = {
    present: '#10B981', absent: '#F87171', makeup: '#0EA5E9',
  };

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 0, overflow: 'hidden' };
  const th = { padding: '10px 12px', textAlign: 'start' as const, fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', whiteSpace: 'nowrap' as const };
  const td = { padding: '10px 12px', verticalAlign: 'middle' as const, whiteSpace: 'nowrap' as const };

  return (
    <div style={card}>
      {pageLoading ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>{t('common.loading')}</div>
      ) : roster.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-3)' }}>{t('enr.none')}</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <th style={th}>{t('common.name')}</th>
              {(['present', 'absent', 'makeup'] as const).map(s => (
                <th key={s} style={{ ...th, textAlign: 'center' }}>{t(`att.${s}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.map(r => (
              <tr key={r.enrollment_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <td style={td}>
                  <div style={{ color: 'var(--fg)', fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                  <div style={{ color: 'var(--fg-3)', fontSize: 11, fontFamily: 'monospace' }}>{r.student_number}</div>
                </td>
                {(['present', 'absent', 'makeup'] as const).map(s => (
                  <td key={s} style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => onStatus(r.enrollment_id, s)} style={pill(r.status === s, statusColors[s])}>
                      {r.status === s ? '✓' : ''}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
