'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { studentsApi, enrollmentsApi, coursesApi, gradesApi, categoriesApi, analyticsApi, predictionApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumb from '@/components/Breadcrumb';
import { useT } from '@/lib/i18n';
import ConfirmModal from '@/components/ConfirmModal';

interface Student {
  student_id: number;
  first_name: string;
  last_name: string;
  student_number: string;
  email: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  city: string | null;
  profession: string | null;
}

interface Grade {
  grade_id: number;
  enrollment_id: number;
  type: string | null;
  category_id: number | null;
  category_name: string | null;
  category_kind: 'regular' | 'weekly' | 'bonus' | null;
  value: number;
  max_value: number | null;
  session_number: number | null;
  date_recorded: string | null;
}

interface Enrollment {
  enrollment_id: number;
  student_id: number;
  course_id: number;
  enrollment_date: string | null;
  completion_status: string;
  absences: number;
  attendance_count: number;
}

interface Course {
  course_id: number;
  title: string;
  status: string;
}

interface Category { id: number; name: string; max_value: number; kind: 'regular' | 'weekly' | 'bonus'; order_index: number; }

interface CourseSummary {
  course_id: number; course_title: string;
  present: number; absent: number; makeup: number;
  total: number; attendance_pct: number | null;
}
interface RecentSession {
  source: string; date: string | null; label: string;
  week_number: number | null; session_type: string | null;
  course_title: string; status: string;
}
interface AttendanceSummary {
  course_summaries: CourseSummary[];
  recent_sessions: RecentSession[];
}

const statusColors: Record<string, string> = { Completed: '#10B981', Ongoing: '#0EA5E9', Dropped: '#F87171' };

const gradeColor = (pct: number) => pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#F87171';

const inp = {
  padding: '8px 10px',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--fg)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
};

function GradeBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 5, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
    </div>
  );
}

export default function StudentDetailPage() {
  const { user, loading } = useRequireRole(['teacher', 'supervisor', 'admin']);
  const router = useRouter();
  const params = useParams();
  const studentId = Number(params.id);
  const { t } = useT();

  const [student, setStudent] = useState<Student | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ enrollment_id: '', category_id: '', value: '', session_number: '', date_recorded: '' });
  const [categoriesByCourse, setCategoriesByCourse] = useState<Record<number, Category[]>>({});
  const [confirmGradeId, setConfirmGradeId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [attSummary, setAttSummary] = useState<AttendanceSummary | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const SESSIONS_PREVIEW = 5;

  interface Submission { id: number; course_id: number; file_name: string | null; submitted_at: string | null; grade: number | null; feedback: string | null; curriculum_session_id: number | null; }
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [gradeInput, setGradeInput] = useState('');

  interface RiskResult { dropout_probability: number; risk_label: 'high' | 'medium' | 'low' | 'insufficient_data'; threshold_used: number; course_id: number; course_title: string; }
  const [riskResults, setRiskResults] = useState<RiskResult[]>([]);

  const backTarget = user?.role === 'teacher'
    ? '/dashboard/teacher/students'
    : user?.role === 'admin'
    ? '/dashboard/admin'
    : '/dashboard/supervisor/students';

  useEffect(() => {
    if (!user || !['teacher', 'supervisor', 'admin'].includes(user.role)) return;
    studentsApi.get(studentId).then(res => setStudent(res.data)).catch(() => router.push(backTarget));
    studentsApi.grades(studentId).then(res => setGrades(res.data));
    enrollmentsApi.list().then(res => setEnrollments(res.data.filter((e: Enrollment) => e.student_id === studentId)));
    coursesApi.list().then(res => setCourses(res.data));
    studentsApi.attendanceSummary(studentId).then(res => setAttSummary(res.data)).catch(() => {});
    studentsApi.submissions(studentId).then(res => setSubmissions(res.data)).catch(() => {});
  }, [user, studentId, router]);

  useEffect(() => {
    if (enrollments.length === 0 || courses.length === 0) return;
    const ongoingEnrollments = enrollments.filter(e => e.completion_status === 'Ongoing');
    Promise.all(
      ongoingEnrollments.map(e => {
        const course = courses.find(c => c.course_id === e.course_id);
        return predictionApi.studentRisk(studentId, e.course_id)
          .then(res => ({ ...res.data, course_id: e.course_id, course_title: course?.title ?? '—' }))
          .catch(() => null);
      })
    ).then(results => setRiskResults(results.filter(Boolean) as RiskResult[]));
  }, [enrollments, courses, studentId]);

  const getCourse = (courseId: number) => courses.find(c => c.course_id === courseId);
  const refreshGrades = () => studentsApi.grades(studentId).then(res => setGrades(res.data));

  useEffect(() => {
    if (enrollments.length === 0) return;
    const wanted = Array.from(new Set(enrollments.map(e => e.course_id))).filter(id => !(id in categoriesByCourse));
    if (wanted.length === 0) return;
    Promise.all(wanted.map(cid =>
      categoriesApi.list(cid).then(r => [cid, r.data] as const).catch(() => [cid, []] as const)
    )).then(results => {
      setCategoriesByCourse(prev => {
        const next = { ...prev };
        for (const [cid, cats] of results) next[cid] = cats;
        return next;
      });
    });
  }, [enrollments]);

  const selectedEnrollment = enrollments.find(e => String(e.enrollment_id) === form.enrollment_id);
  const formCategories = selectedEnrollment ? (categoriesByCourse[selectedEnrollment.course_id] ?? []) : [];
  const selectedCategory = formCategories.find(c => String(c.id) === form.category_id);

  const handleCreateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.category_id) { setError(t('grade.pick_category')); return; }
    try {
      await gradesApi.create({
        enrollment_id: parseInt(form.enrollment_id),
        category_id: parseInt(form.category_id),
        value: parseFloat(form.value),
        session_number: form.session_number ? parseInt(form.session_number) : null,
        date_recorded: form.date_recorded || null,
      });
      setShowForm(false);
      setForm({ enrollment_id: '', category_id: '', value: '', session_number: '', date_recorded: '' });
      refreshGrades();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
    }
  };

  const handleDeleteGrade = async (id: number) => {
    try {
      await gradesApi.delete(id);
      setConfirmGradeId(null);
      refreshGrades();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
      setConfirmGradeId(null);
    }
  };

  const gradesByEnrollment = enrollments.map(en => {
    const own = grades.filter(g => g.enrollment_id === en.enrollment_id);
    const byCat = new Map<string, { name: string; kind: string | null; entries: Grade[] }>();
    for (const g of own) {
      const key = g.category_id != null ? `cat-${g.category_id}` : `legacy-${g.type ?? 'other'}`;
      const name = g.category_name ?? g.type ?? '—';
      if (!byCat.has(key)) byCat.set(key, { name, kind: g.category_kind ?? null, entries: [] });
      byCat.get(key)!.entries.push(g);
    }
    const totalNum = own.reduce((s, g) => s + (g.max_value ? g.value : 0), 0);
    const totalDen = own.reduce((s, g) => s + (g.max_value ?? 0), 0);
    const pct = totalDen > 0 ? Math.round((totalNum / totalDen) * 1000) / 10 : null;
    return { enrollment: en, categories: Array.from(byCat.values()), total: pct, totalNum, totalDen };
  });

  const overall = (() => {
    const num = grades.reduce((s, g) => s + (g.max_value ? g.value : 0), 0);
    const den = grades.reduce((s, g) => s + (g.max_value ?? 0), 0);
    return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
  })();

  if (loading || !student) return (
    <DashboardLayout>
      <div className="sk" style={{ height: 14, width: 120, borderRadius: 6, marginBottom: 24 }} />
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="sk" style={{ height: 24, width: 240, borderRadius: 8 }} />
        <div className="sk" style={{ height: 14, width: 180, borderRadius: 6, marginTop: 10 }} />
      </div>
      <div className="grid-2">
        {[0, 1].map(i => (
          <div key={i} className="card">
            {[80, 65, 75, 60].map((w, j) => (
              <div key={j} className="row-divide" style={{ padding: '12px 0' }}>
                <div className="sk" style={{ height: 13, width: `${w}%`, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <Breadcrumb crumbs={[
        { label: t('nav.students'), href: backTarget },
        { label: `${student.first_name} ${student.last_name}` },
      ]} />

      {error && <p style={{ color: '#F87171', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {/* Header card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ color: '#0EA5E9', fontSize: 12, fontFamily: 'monospace', marginBottom: 6 }}>{student.student_number}</p>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }} className="text-fg">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-fg2" style={{ fontSize: 14, marginTop: 4 }}>{student.email || t('student.no_email')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              {student.date_of_birth && (
                <span className="text-fg3" style={{ fontSize: 13 }}>
                  🎂 {new Date().getFullYear() - new Date(student.date_of_birth).getFullYear()} {t('student.age').toLowerCase()}
                </span>
              )}
              {student.city && (
                <span className="text-fg3" style={{ fontSize: 13 }}>📍 {student.city}</span>
              )}
              {student.profession && (
                <span className="text-fg3" style={{ fontSize: 13 }}>💼 {student.profession}</span>
              )}
              {student.phone_number && (
                <a href={`tel:${student.phone_number}`} style={{ color: '#10B981', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
                  📞 {student.phone_number}
                </a>
              )}
            </div>
          </div>
          {overall !== null && (
            <div style={{ textAlign: 'right' }}>
              <p className="text-fg3" style={{ fontSize: 12, marginBottom: 4 }}>{t('grade.average')}</p>
              <p style={{ fontSize: 36, fontWeight: 800, color: gradeColor(overall), fontFamily: "'Syne', sans-serif" }}>{overall}%</p>
              <GradeBar value={overall} max={100} color={gradeColor(overall)} />
            </div>
          )}
        </div>

        {/* Enrollment status chips */}
        {enrollments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
            {enrollments.map(e => {
              const course = getCourse(e.course_id);
              return (
                <span key={e.enrollment_id} style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: `${statusColors[e.completion_status]}15`,
                  color: statusColors[e.completion_status],
                  border: `1px solid ${statusColors[e.completion_status]}30`,
                }}>
                  {course?.title || `#${e.course_id}`} · {t(`enr.status_${e.completion_status.toLowerCase()}`)}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Enrollments + attendance */}
        <div className="card">
          <h2 className="text-fg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{t('nav.enrollments')}</h2>
          {enrollments.length === 0
            ? <p className="text-fg3" style={{ fontSize: 14 }}>{t('student.not_enrolled')}</p>
            : enrollments.map(e => {
              const course = getCourse(e.course_id);
              const attended = e.attendance_count ?? 0;
              const absent = e.absences ?? 0;
              const total = attended + absent;
              const attPct = total > 0 ? Math.round((attended / total) * 100) : null;
              return (
                <div key={e.enrollment_id} className="row-divide" style={{ padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-fg" style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {course?.title || `Course #${e.course_id}`}
                      </p>
                      <p className="text-fg3" style={{ fontSize: 12, marginTop: 2 }}>
                        {t('enr.since')} {e.enrollment_date || '—'}
                      </p>
                      {attPct !== null && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span className="text-fg3" style={{ fontSize: 11 }}>{t('nav.attendance')}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: attPct >= 75 ? '#10B981' : '#F59E0B' }}>{attPct}%</span>
                          </div>
                          <GradeBar value={attPct} max={100} color={attPct >= 75 ? '#10B981' : '#F59E0B'} />
                        </div>
                      )}
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0, background: `${statusColors[e.completion_status]}15`, color: statusColors[e.completion_status], border: `1px solid ${statusColors[e.completion_status]}30` }}>
                      {t(`enr.status_${e.completion_status.toLowerCase()}`)}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Grades */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="text-fg" style={{ fontSize: 15, fontWeight: 700 }}>{t('grade.grades')}</h2>
            {enrollments.length > 0 && !showForm && (
              <button onClick={() => { setShowForm(true); setError(''); setForm({ enrollment_id: String(enrollments[0].enrollment_id), category_id: '', value: '', session_number: '', date_recorded: '' }); }}
                style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + {t('grade.add')}
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleCreateGrade} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <select value={form.enrollment_id} onChange={e => setForm({ ...form, enrollment_id: e.target.value })} required style={inp}>
                  {enrollments.map(en => (
                    <option key={en.enrollment_id} value={en.enrollment_id}>{getCourse(en.course_id)?.title || `Course #${en.course_id}`}</option>
                  ))}
                </select>
                <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value, session_number: '' })} required style={inp}>
                  <option value="">{formCategories.length === 0 ? t('cat.none') : t('grade.pick_category')}</option>
                  {formCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (/{c.max_value}){c.kind !== 'regular' ? ` · ${t(`cat.kind_${c.kind}`)}` : ''}</option>
                  ))}
                </select>
                <input type="number" step="0.1" min="0" max={selectedCategory?.max_value ?? undefined}
                  placeholder={selectedCategory ? `0–${selectedCategory.max_value}` : t('grade.value')} required
                  value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} style={inp} />
                {selectedCategory?.kind === 'weekly' && (
                  <input type="number" min={1} placeholder={t('import.col_week')}
                    value={form.session_number} onChange={e => setForm({ ...form, session_number: e.target.value })} style={inp} />
                )}
                <input type="date" value={form.date_recorded} onChange={e => setForm({ ...form, date_recorded: e.target.value })} style={inp} />
              </div>
              {error && <p style={{ color: '#F87171', fontSize: 12, marginBottom: 8 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('common.save')}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg-2)', fontSize: 12, cursor: 'pointer' }}>{t('common.cancel')}</button>
              </div>
            </form>
          )}

          {grades.length === 0 && !showForm
            ? <p className="text-fg3" style={{ fontSize: 14 }}>{t('grade.none')}</p>
            : gradesByEnrollment.filter(b => b.categories.length > 0).map(block => {
              const course = getCourse(block.enrollment.course_id);
              const pct = block.total;
              return (
                <div key={block.enrollment.enrollment_id} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <p className="text-fg" style={{ fontSize: 13, fontWeight: 700 }}>{course?.title || `Course #${block.enrollment.course_id}`}</p>
                    {pct !== null && (
                      <span style={{ color: gradeColor(pct), fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{pct}%</span>
                    )}
                  </div>
                  {pct !== null && <GradeBar value={pct} max={100} color={gradeColor(pct)} />}

                  <div style={{ marginTop: 10 }}>
                    {block.categories.map(cat => {
                      const num = cat.entries.reduce((s, g) => s + g.value, 0);
                      const den = cat.entries.reduce((s, g) => s + (g.max_value ?? 0), 0);
                      const isWeekly = cat.kind === 'weekly';
                      const display = isWeekly && cat.entries.length > 0
                        ? Math.round((num / cat.entries.length) * 100) / 100
                        : num;
                      const denDisplay = isWeekly ? (cat.entries[0]?.max_value ?? den) : den;
                      const catPct = denDisplay > 0 ? (Number(display) / denDisplay) * 100 : 0;
                      return (
                        <div key={cat.name} className="row-divide" style={{ padding: '7px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="text-fg" style={{ fontSize: 12, fontWeight: 500 }}>
                                {cat.name}{isWeekly ? ` · ${cat.entries.length}×` : ''}
                              </p>
                              {isWeekly && (
                                <p className="text-fg3" style={{ fontSize: 11, marginTop: 2 }}>
                                  {cat.entries.sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0)).map(e => `${e.session_number ?? '?'}: ${e.value}`).join('  ·  ')}
                                </p>
                              )}
                              <GradeBar value={catPct} max={100} color={gradeColor(catPct)} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 12, flexShrink: 0 }}>
                              <span className="text-fg" style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                                {display}{denDisplay ? ` / ${denDisplay}` : ''}
                              </span>
                              <button onClick={() => setConfirmGradeId(cat.entries[cat.entries.length - 1]?.grade_id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 14, padding: '2px 4px', lineHeight: 1 }}
                                title={t('grade.delete')}>
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── Attendance History ── */}
      {attSummary && (attSummary.course_summaries.length > 0 || attSummary.recent_sessions.length > 0) && (
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* Per-course attendance breakdown */}
          {attSummary.course_summaries.filter(s => s.total > 0).length > 0 && (
            <div className="card">
              <h2 className="text-fg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                {t('student.att_breakdown')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {attSummary.course_summaries.filter(s => s.total > 0).map(s => {
                  const pct = s.attendance_pct ?? 0;
                  const pctColor = pct >= 75 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#F87171';
                  // Build dot array: present=green, absent=red, makeup=blue
                  const dots = [
                    ...Array(s.present).fill('present'),
                    ...Array(s.absent).fill('absent'),
                    ...Array(s.makeup).fill('makeup'),
                  ];
                  const dotColor: Record<string, string> = { present: '#10B981', absent: '#F87171', makeup: '#0EA5E9' };
                  return (
                    <div key={s.course_id} style={{ paddingBottom: 16, borderBottom: '1px solid var(--border-soft)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <p className="text-fg" style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{s.course_title}</p>
                        <span style={{ fontSize: 15, fontWeight: 800, color: pctColor, fontFamily: "'Syne', sans-serif" }}>{pct}%</span>
                      </div>

                      {/* Attendance dots */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                        {dots.map((status, i) => (
                          <div key={i} title={status} style={{ width: 12, height: 12, borderRadius: 3, background: dotColor[status] }} />
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div style={{ background: 'var(--border-soft)', borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pctColor, borderRadius: 99 }} />
                      </div>

                      {/* Counts row */}
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>✓ {s.present} {t('att.present')}</span>
                        <span style={{ fontSize: 12, color: '#F87171', fontWeight: 600 }}>✗ {s.absent} {t('att.absent')}</span>
                        {s.makeup > 0 && <span style={{ fontSize: 12, color: '#0EA5E9', fontWeight: 600 }}>↺ {s.makeup} {t('att.makeup')}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent sessions timeline */}
          {attSummary.recent_sessions.length > 0 && (
            <div className="card">
              <h2 className="text-fg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                {t('student.recent_sessions')}
              </h2>
              {(() => {
                const visible = showAllSessions
                  ? attSummary.recent_sessions
                  : attSummary.recent_sessions.slice(0, SESSIONS_PREVIEW);
                return (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {visible.map((r, i) => {
                        const statusColor: Record<string, string> = { present: '#10B981', absent: '#F87171', makeup: '#0EA5E9' };
                        const color = statusColor[r.status] ?? '#64748B';
                        const isLast = i === visible.length - 1;
                        return (
                          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: !isLast ? '1px solid var(--border-soft)' : 'none', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                              {!isLast && (
                                <div style={{ width: 2, flex: 1, background: 'var(--border-soft)', marginTop: 4, minHeight: 16 }} />
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <p className="text-fg" style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</p>
                                  <p className="text-fg3" style={{ fontSize: 11, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.course_title}</p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 3 }}>
                                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}40`, whiteSpace: 'nowrap' }}>
                                    {r.status === 'present' ? t('att.present') : r.status === 'absent' ? t('att.absent') : t('att.makeup')}
                                  </span>
                                  {r.date && <span className="text-fg3" style={{ fontSize: 10 }}>{r.date}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {attSummary.recent_sessions.length > SESSIONS_PREVIEW && (
                      <button
                        onClick={() => setShowAllSessions(v => !v)}
                        style={{ marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--surface-2)', color: 'var(--fg2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-3)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)')}
                      >
                        {showAllSessions
                          ? t('common.show_less')
                          : `${t('common.show_more')} (${attSummary.recent_sessions.length - SESSIONS_PREVIEW})`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── Dropout Risk ── */}
      {riskResults.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
            </svg>
            <h2 className="text-fg" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{t('risk.title')}</h2>
            <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>{t('risk.ml_prediction')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {riskResults.map(r => {
              const RISK_LABEL_KEYS: Record<string, string> = {
                high: 'risk.high', medium: 'risk.medium',
                low: 'risk.low', insufficient_data: 'risk.no_data',
              };
              const cfg = {
                high:              { color: '#EF4444', bg: '#EF444415', border: '#EF444430' },
                medium:            { color: '#F59E0B', bg: '#F59E0B15', border: '#F59E0B30' },
                low:               { color: '#10B981', bg: '#10B98115', border: '#10B98130' },
                insufficient_data: { color: '#64748B', bg: '#64748B10', border: '#64748B25' },
              }[r.risk_label];
              const pct = Math.round(r.dropout_probability * 100);
              return (
                <div key={r.course_id} style={{ padding: '12px 16px', background: 'var(--surface-2)', border: `1px solid ${cfg.border}`, borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>{r.course_title}</p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, padding: '2px 10px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20 }}>
                      {t(RISK_LABEL_KEYS[r.risk_label])}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 7, background: 'var(--border-soft)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: cfg.color, minWidth: 40, textAlign: 'right', fontFamily: "'Syne', sans-serif" }}>
                      {pct}%
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '6px 0 0' }}>
                    {t('risk.threshold_label', { pct: String(Math.round(r.threshold_used * 100)) })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Telegram Bot Submissions ── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <h2 className="text-fg" style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            {t('student.bot_submissions')}
          </h2>
          {submissions.length > 0 && (
            <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--fg-3)' }}>
              {submissions.filter(s => s.grade === null).length} {t('student.ungraded')}
            </span>
          )}
        </div>

        {submissions.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--fg-3)', textAlign: 'center', padding: '24px 0' }}>
            {t('student.no_submissions')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submissions.map(sub => {
              const course = courses.find(c => c.course_id === sub.course_id);
              const isGrading = gradingId === sub.id;
              return (
                <div key={sub.id} style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* File icon */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#8B5CF615', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub.file_name || t('student.submission_file')}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '2px 0 0' }}>
                      {course?.title ?? '—'} · {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '—'}
                    </p>
                  </div>

                  {/* Grade badge or grading input */}
                  {isGrading ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number" value={gradeInput} onChange={e => setGradeInput(e.target.value)}
                        placeholder="0–20" min={0} max={20} step={0.5}
                        style={{ ...inp, width: 70 }}
                        autoFocus
                      />
                      <button
                        onClick={async () => {
                          if (!gradeInput) return;
                          try {
                            const { submissionsApi } = await import('@/lib/api');
                            await submissionsApi.grade(sub.id, { grade: Number(gradeInput) });
                            setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, grade: Number(gradeInput) } : s));
                          } catch {}
                          setGradingId(null); setGradeInput('');
                        }}
                        style={{ padding: '6px 12px', background: '#8B5CF6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >✓</button>
                      <button onClick={() => { setGradingId(null); setGradeInput(''); }}
                        style={{ padding: '6px 10px', background: 'var(--border)', color: 'var(--fg-2)', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : sub.grade !== null ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: sub.grade >= 10 ? '#10B981' : '#F87171', fontFamily: "'Syne', sans-serif" }}>
                        {sub.grade}/20
                      </span>
                      {user?.role === 'teacher' && (
                        <button onClick={() => { setGradingId(sub.id); setGradeInput(String(sub.grade)); }}
                          style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 11 }}>
                          {t('common.edit')}
                        </button>
                      )}
                    </div>
                  ) : (
                    user?.role === 'teacher' ? (
                      <button onClick={() => { setGradingId(sub.id); setGradeInput(''); }}
                        style={{ padding: '5px 12px', background: '#8B5CF615', color: '#8B5CF6', border: '1px solid #8B5CF640', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {t('student.grade_now')}
                      </button>
                    ) : (
                      <span style={{ padding: '4px 10px', background: '#F59E0B15', color: '#F59E0B', border: '1px solid #F59E0B40', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                        {t('student.pending_grade')}
                      </span>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmGradeId !== null && (
        <ConfirmModal
          messageKey='grade.confirm_delete'
          onConfirm={() => handleDeleteGrade(confirmGradeId)}
          onCancel={() => setConfirmGradeId(null)}
        />
      )}
    </DashboardLayout>
  );
}
