'use client';

import { useEffect, useRef } from 'react';
import { useT } from '@/lib/i18n';

interface ConfirmModalProps {
  messageKey: string;
  subject?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}

export default function ConfirmModal({ messageKey, subject, onConfirm, onCancel, confirmLabel }: ConfirmModalProps) {
  const { t } = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Auto-focus the safe (Cancel) button on mount
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCancel(); return; }

      // Trap Tab/Shift-Tab within the two buttons
      if (e.key === 'Tab') {
        const els = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="modal-pop"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 16, padding: '32px 36px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          minWidth: 320, maxWidth: 420, width: '90%',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p id="confirm-modal-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>
            {t('common.sure')}
          </p>
          <p style={{ fontSize: 14, color: 'var(--fg-2)', margin: 0 }}>{t(messageKey)}</p>
          {subject && (
            <p style={{
              fontSize: 13, fontWeight: 600, color: 'var(--fg)',
              margin: 0, padding: '8px 12px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8,
            }}>
              {subject}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{ padding: '9px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}
          >
            {t('common.no')}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{ padding: '9px 18px', background: '#DC2626', border: 'none', borderRadius: 8, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {confirmLabel ?? t('common.yes')}
          </button>
        </div>
      </div>
    </div>
  );
}
