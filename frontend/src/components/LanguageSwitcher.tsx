'use client';
import { Lang, useT } from '@/lib/i18n';

const options: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'ar', label: 'ع' },
];

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useT();
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
      {options.map(o => {
        const active = lang === o.code;
        return (
          <button key={o.code} onClick={() => setLang(o.code)}
            style={{
              padding: compact ? '4px 10px' : '5px 12px',
              borderRadius: 999,
              border: 'none',
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? '#10B981' : 'var(--fg-2)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 3px rgba(15,23,42,0.1)' : 'none',
              fontFamily: o.code === 'ar' ? 'serif' : "'DM Sans', sans-serif",
              transition: 'all 0.15s',
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
