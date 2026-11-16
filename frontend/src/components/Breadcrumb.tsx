'use client';
import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="var(--fg-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
            {isLast || !crumb.href ? (
              <span style={{ fontSize: 13, color: isLast ? 'var(--fg)' : 'var(--fg-2)', fontWeight: isLast ? 600 : 400 }}
                aria-current={isLast ? 'page' : undefined}>
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} style={{ fontSize: 13, color: 'var(--fg-2)', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-2)')}>
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
