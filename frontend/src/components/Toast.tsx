'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: 'M5 13l4 4L19 7',
  error:   'M6 18L18 6M6 6l12 12',
  info:    'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const COLORS: Record<ToastType, { border: string; icon: string; bg: string }> = {
  success: { border: '#10B981', icon: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  error:   { border: '#F87171', icon: '#F87171', bg: 'rgba(248,113,113,0.08)' },
  info:    { border: '#0EA5E9', icon: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
};

const DURATION = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), DURATION);
  }, [dismiss]);

  const ctx: ToastContextValue = {
    success: (msg) => push('success', msg),
    error:   (msg) => push('error', msg),
    info:    (msg) => push('info', msg),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 24,
        insetInlineEnd: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(toast => {
          const c = COLORS[toast.type];
          return (
            <div key={toast.id} className="toast-slide-in" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: 'var(--surface)',
              border: `1px solid ${c.border}`,
              borderLeft: `3px solid ${c.border}`,
              borderRadius: 10,
              boxShadow: '0 4px 20px rgba(15,23,42,0.15)',
              backgroundColor: `color-mix(in srgb, var(--surface) 92%, transparent)`,
              backdropFilter: 'blur(8px)',
              minWidth: 260,
              maxWidth: 360,
              pointerEvents: 'all',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: c.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke={c.icon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICONS[toast.type]} />
                </svg>
              </div>
              <span style={{
                fontSize: 13,
                color: 'var(--fg)',
                fontFamily: "'DM Sans', sans-serif",
                flex: 1,
              }}>
                {toast.message}
              </span>
              <button onClick={() => dismiss(toast.id)} style={{
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: 'var(--fg-3)',
                fontSize: 14, lineHeight: 1, padding: '0 2px',
                flexShrink: 0,
              }}>✕</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
