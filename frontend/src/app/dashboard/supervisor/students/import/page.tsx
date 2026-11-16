'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { studentsApi } from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { useT } from '@/lib/i18n';
import Link from 'next/link';
import * as XLSX from 'xlsx';

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; student_number: string; reason: string }[];
}

const TEMPLATE_CSV =
  'last_name,first_name,student_number,phone_number,city,profession,date_of_birth,email\n' +
  'بن علي,أمينة,2024001,+213 770 123 456,الجزائر,طالبة,2000-05-14,amina@example.com\n' +
  'حمدي,سارة,2024002,+213 661 987 654,وهران,معلمة,,\n';

export default function StudentImportPage() {
  const { user, loading } = useRequireRole('supervisor');
  const { t } = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  // If the user picks an Excel file, convert it to CSV first then upload
  const prepareFile = async (raw: File): Promise<File> => {
    if (!raw.name.toLowerCase().endsWith('.xlsx')) return raw;
    const buffer = await raw.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new File(['﻿' + csv], raw.name.replace(/\.xlsx$/i, '.csv'), { type: 'text/csv' });
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const fileToUpload = await prepareFile(file);
      const res = await studentsApi.importCsv(fileToUpload);
      setResult(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    const rows = [
      ['last_name', 'first_name', 'student_number', 'phone_number', 'city', 'profession', 'date_of_birth', 'email'],
      ['بن علي', 'أمينة', '2024001', '+213 770 123 456', 'الجزائر', 'طالبة', '2000-05-14', 'amina@example.com'],
      ['حمدي', 'سارة', '2024002', '+213 661 987 654', 'وهران', 'معلمة', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Style the header row (bold) — basic column widths
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'students_import_template.xlsx');
  };

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, marginBottom: 20 };

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 className="page-title">{t('student.import_title')}</h1>
          <p className="page-sub">{t('student.import_sub')}</p>
        </div>
        <Link href="/dashboard/supervisor/students"
          style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--fg-2)', fontSize: 14, textDecoration: 'none' }}>
          ← {t('student.back')}
        </Link>
      </div>

      {/* Template download */}
      <div style={card}>
        <h2 className="text-fg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>1. {t('student.import_step1_heading')}</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={downloadCsvTemplate}
            style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: '#10B981', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t('student.import_dl_csv')}
          </button>
          <button onClick={downloadExcelTemplate}
            style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: '#8B5CF6', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {t('student.import_dl_excel')}
          </button>
        </div>
      </div>

      {/* Upload */}
      {!result && (
        <div style={card}>
          <h2 className="text-fg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>2. {t('student.import_btn')}</h2>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? '#10B981' : 'var(--border)'}`,
              borderRadius: 12, padding: '36px 20px', textAlign: 'center',
              cursor: 'pointer', marginBottom: 16,
              background: file ? 'rgba(16,185,129,0.04)' : 'var(--surface-2)',
              transition: 'border-color 0.2s, background 0.2s',
            }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>📄</p>
            {file
              ? <p className="text-fg" style={{ fontWeight: 600, fontSize: 14 }}>✅ {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
              : <p className="text-fg2" style={{ fontSize: 14 }}>
                  {t('import.choose_file')}{' '}
                  <span style={{ color: '#10B981' }}>.csv</span>
                  {' '}<span style={{ color: 'var(--fg-3)' }}>or</span>{' '}
                  <span style={{ color: '#8B5CF6' }}>.xlsx</span>
                </p>
            }
            <p className="text-fg3" style={{ fontSize: 12, marginTop: 6 }}>CSV or Excel — first sheet, header row required</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError(''); }} />

          {error && <p style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{
              padding: '11px 28px',
              background: file && !uploading ? 'linear-gradient(135deg, #10B981, #059669)' : 'var(--border)',
              border: 'none', borderRadius: 10,
              color: file && !uploading ? 'white' : 'var(--fg-3)',
              fontSize: 14, fontWeight: 700,
              cursor: file && !uploading ? 'pointer' : 'not-allowed',
            }}>
            {uploading ? t('student.import_uploading') : t('student.import_btn')}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={card}>
          <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
            ✅ {t('student.import_success')}
          </h2>

          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: t('student.import_created'), value: result.created, color: '#10B981' },
              { label: t('student.import_skipped'), value: result.skipped, color: '#F59E0B' },
              { label: t('student.import_errors'), value: result.errors.length, color: result.errors.length ? '#F87171' : 'var(--fg-3)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '16px 20px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <p style={{ color, fontSize: 36, fontWeight: 800, fontFamily: "'Syne', sans-serif", margin: 0 }}>{value}</p>
                <p className="text-fg2" style={{ fontSize: 12, marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Error detail table */}
          {result.errors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: '#F87171', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                {t('student.import_errors')} — {result.errors.length} row(s) failed:
              </p>
              <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Row', 'Student #', 'Reason'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--fg-2)', fontFamily: 'monospace' }}>{err.row}</td>
                        <td style={{ padding: '10px 14px', color: '#0EA5E9', fontFamily: 'monospace' }}>{err.student_number}</td>
                        <td style={{ padding: '10px 14px', color: '#F87171' }}>{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setResult(null); setFile(null); setError(''); }}
              style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer' }}>
              {t('student.import_another')}
            </button>
            <Link href="/dashboard/supervisor/students"
              style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              {t('nav.students')} →
            </Link>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
