'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { categoriesApi, coursesApi, importApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { useT } from '@/lib/i18n';

interface Course { course_id: number; title: string; supervisor_id: number | null; }
interface Category { id: number; name: string; max_value: number; kind: 'regular' | 'weekly' | 'bonus'; order_index: number; }
interface GradeCol { header: string; category_id: string; session_number: string; }
interface RowError { row: number; student: string; reason: string; }
interface CommitResult {
  students_imported: number; grades_imported: number;
  failed_rows: number; errors: RowError[];
}

const select = (value: string, onChange: (v: string) => void, options: string[], placeholder = '— select —') => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, width: '100%', background: 'var(--input-bg)', color: 'var(--fg)' }}
  >
    <option value="">{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

export default function ImportPage() {
  const { user, loading } = useRequireRole(['supervisor', 'admin', 'teacher']);
  const { t } = useT();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Step 2 state
  const [token, setToken] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [sample, setSample] = useState<Record<string, string>[]>([]);
  const [nameCol, setNameCol] = useState('');
  const [numberCol, setNumberCol] = useState('');
  const [gradeCols, setGradeCols] = useState<GradeCol[]>([]);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState('');

  // Step 3 state
  const [result, setResult] = useState<CommitResult | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      coursesApi.list().then(res => {
        setCourses(res.data);
      }).catch(() => {});
    }
  }, [user]);

  // When the selected course changes, fetch its categories
  useEffect(() => {
    if (!courseId) { setCategories([]); return; }
    categoriesApi.list(parseInt(courseId, 10))
      .then(res => setCategories(res.data))
      .catch(() => setCategories([]));
  }, [courseId]);

  // When headers change, reset grade col mapping
  useEffect(() => {
    if (!headers.length) return;
    const used = new Set([nameCol, numberCol].filter(Boolean));
    setGradeCols(
      headers
        .filter(h => !used.has(h))
        .map(h => ({ header: h, category_id: '', session_number: '' }))
    );
  }, [nameCol, numberCol, headers]);

  const handleUpload = async () => {
    if (!file || !courseId) return;
    setUploading(true);
    setUploadError('');
    try {
      const res = await importApi.upload(file);
      setToken(res.data.token);
      setHeaders(res.data.headers);
      setRowCount(res.data.row_count);
      setSample(res.data.sample);
      setStep(2);
    } catch (e: any) {
      setUploadError(e.response?.data?.detail || t('import.upload_error'));
    } finally {
      setUploading(false);
    }
  };

  const updateGradeCol = (idx: number, field: keyof GradeCol, value: string) => {
    setGradeCols(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const handleCommit = async () => {
    if (!nameCol) { setCommitError(t('import.err_name')); return; }
    const mappedGrades = gradeCols.filter(g => g.category_id);
    if (!mappedGrades.length) { setCommitError(t('import.err_grade')); return; }
    setCommitting(true);
    setCommitError('');
    try {
      const res = await importApi.commit({
        token,
        course_id: parseInt(courseId),
        student_name_col: nameCol,
        student_number_col: numberCol || null,
        grade_cols: mappedGrades.map(g => ({
          header: g.header,
          category_id: parseInt(g.category_id, 10),
          session_number: g.session_number ? parseInt(g.session_number, 10) : null,
        })),
      });
      setResult(res.data);
      setStep(3);
    } catch (e: any) {
      setCommitError(e.response?.data?.detail || t('import.err_commit'));
    } finally {
      setCommitting(false);
    }
  };

  const reset = () => {
    setStep(1); setFile(null); setToken(''); setHeaders([]); setSample([]);
    setNameCol(''); setNumberCol(''); setGradeCols([]); setResult(null);
    setUploadError(''); setCommitError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 };
  const label = { display: 'block', color: 'var(--fg-2)', fontSize: 13, fontWeight: 600, marginBottom: 6 };
  const inputStyle = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box' as const, background: 'var(--input-bg)', color: 'var(--fg)' };
  const btn = (accent: string) => ({
    background: accent, color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  });

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">
          {t('import.title')}
        </h1>
        <p className="page-sub">
          {t('import.subtitle')}
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {([t('import.step_upload'), t('import.step_map'), t('import.step_results')] as const).map((label, i) => (
          <div key={i} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            background: step === i + 1 ? '#0EA5E9' : step > i + 1 ? '#D1FAE5' : 'var(--surface-2)',
            color: step === i + 1 ? '#fff' : step > i + 1 ? '#065F46' : 'var(--fg-3)',
          }}>{label}</div>
        ))}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div style={card}>
          <div style={{ marginBottom: 20 }}>
            <label style={label}>{t('enr.pick_course')}</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} style={inputStyle}>
              <option value="">{t('import.select_course')}</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.title}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={label}>{t('import.file_label')}</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ background: 'var(--surface-2)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {t('import.choose_file')}
              </button>
              <span style={{ color: file ? 'var(--fg)' : 'var(--fg-3)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file ? file.name : t('import.no_file')}
              </span>
            </div>
            <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 8 }}>
              {t('import.file_hint')}
            </p>
          </div>
          {uploadError && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
              {uploadError}
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={!file || !courseId || uploading}
            style={{ ...btn('#0EA5E9'), opacity: (!file || !courseId || uploading) ? 0.5 : 1 }}
          >
            {uploading ? t('import.uploading') : t('import.upload_btn')}
          </button>
        </div>
      )}

      {/* ── Step 2: Map columns ── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={card}>
            <p style={{ color: 'var(--fg-2)', fontSize: 13, marginBottom: 16 }}>
              {t('import.detected', { rows: rowCount, cols: headers.length })}
            </p>

            {/* Sample preview */}
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {headers.map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.map((row, i) => (
                    <tr key={i}>
                      {headers.map(h => (
                        <td key={h} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-soft)', color: 'var(--fg)' }}>{row[h] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Name + number mapping */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={label}>{t('import.name_col')} <span style={{ color: '#EF4444' }}>*</span></label>
                {select(nameCol, setNameCol, headers)}
              </div>
              <div>
                <label style={label}>{t('import.number_col')} <span style={{ color: 'var(--fg-3)' }}>({t('common.optional')})</span></label>
                {select(numberCol, setNumberCol, ['', ...headers], t('import.no_col'))}
              </div>
            </div>
          </div>

          {/* Grade column mapping */}
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>{t('import.grade_cols_title')}</h2>
            <p style={{ color: 'var(--fg-2)', fontSize: 13, marginBottom: 16 }}>
              {t('import.grade_cols_help')}
            </p>
            {categories.length === 0 ? (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', color: '#F59E0B', fontSize: 13 }}>
                {t('import.no_categories')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>
                  <span style={{ color: 'var(--fg-3)', fontSize: 13, fontWeight: 600 }}>{t('import.col_header')}</span>
                  <span style={{ color: 'var(--fg-3)', fontSize: 13, fontWeight: 600 }}>{t('import.col_category')}</span>
                  <span style={{ color: 'var(--fg-3)', fontSize: 13, fontWeight: 600 }}>{t('import.col_week')}</span>
                </div>
                {gradeCols.map((gc, i) => {
                  const selectedCat = categories.find(c => String(c.id) === gc.category_id);
                  const isWeekly = selectedCat?.kind === 'weekly';
                  return (
                    <div key={gc.header} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>{gc.header}</span>
                      <select
                        value={gc.category_id}
                        onChange={e => updateGradeCol(i, 'category_id', e.target.value)}
                        style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13, width: '100%', background: 'var(--input-bg)', color: 'var(--fg)' }}
                      >
                        <option value="">{t('import.skip')}</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name} (/{c.max_value}){c.kind !== 'regular' ? ` · ${t(`cat.kind_${c.kind}`)}` : ''}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        placeholder={isWeekly ? '1' : '—'}
                        value={gc.session_number}
                        onChange={e => updateGradeCol(i, 'session_number', e.target.value)}
                        disabled={!isWeekly}
                        style={{ ...inputStyle, opacity: isWeekly ? 1 : 0.4 }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {commitError && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', color: '#B91C1C', fontSize: 13 }}>
              {commitError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={reset} style={{ ...btn('#64748B') }}>{t('import.back')}</button>
            <button onClick={handleCommit} disabled={committing} style={{ ...btn('#10B981'), opacity: committing ? 0.6 : 1 }}>
              {committing ? t('import.committing') : t('import.commit_btn')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Results ── */}
      {step === 3 && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ ...card, textAlign: 'center' }}>
              <p style={{ color: '#10B981', fontSize: 32, fontWeight: 800 }}>{result.students_imported}</p>
              <p style={{ color: 'var(--fg-2)', fontSize: 13, marginTop: 4 }}>{t('import.students_imported')}</p>
            </div>
            <div style={{ ...card, textAlign: 'center' }}>
              <p style={{ color: '#0EA5E9', fontSize: 32, fontWeight: 800 }}>{result.grades_imported}</p>
              <p style={{ color: 'var(--fg-2)', fontSize: 13, marginTop: 4 }}>{t('import.grades_recorded')}</p>
            </div>
            <div style={{ ...card, textAlign: 'center' }}>
              <p style={{ color: result.failed_rows > 0 ? '#EF4444' : '#10B981', fontSize: 32, fontWeight: 800 }}>
                {result.failed_rows}
              </p>
              <p style={{ color: 'var(--fg-2)', fontSize: 13, marginTop: 4 }}>{t('import.failed_rows')}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div style={card}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#B91C1C', marginBottom: 12 }}>
                {t('import.failed_help')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.errors.map((err, i) => (
                  <div key={i} style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                    <span style={{ color: 'var(--fg-2)', marginRight: 8 }}>Row {err.row}</span>
                    {err.student && <span style={{ color: 'var(--fg)', fontWeight: 600, marginRight: 8 }}>{err.student}</span>}
                    <span style={{ color: '#B91C1C' }}>{err.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <button onClick={reset} style={btn('#0EA5E9')}>{t('import.import_another')}</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
