'use client';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '56px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 20,
      }}>
        {icon}
      </div>
      <p style={{
        fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700,
        color: 'var(--fg)', marginBottom: description ? 8 : 0,
      }}>
        {title}
      </p>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--fg-3)', maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 20, padding: '9px 20px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none', borderRadius: 10,
            color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
