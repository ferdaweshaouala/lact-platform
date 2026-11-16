'use client';

export interface NoteReply {
  id: number;
  content: string;
  parent_id: number;
  created_at: string | null;
  author_name: string;
  author_role: string;
}

export interface ThreadNote {
  id: number;
  content: string;
  created_at: string | null;
  author_name: string;
  author_role: string;
  curriculum_session_id: number | null;
  parent_id: number | null;
  replies: NoteReply[];
  course_id?: number;
  course_title?: string;
}

interface Props {
  note: ThreadNote;
  reply: string;
  sending: boolean;
  onClose: () => void;
  onReplyChange: (v: string) => void;
  onSend: () => void;
  fmtTime: (iso: string | null) => string;
  t: (key: string, vars?: Record<string, string>) => string;
}

export default function ThreadModal({ note, reply, sending, onClose, onReplyChange, onSend, fmtTime, t }: Props) {
  const allMessages = [
    { id: note.id, content: note.content, author_name: note.author_name, author_role: note.author_role, created_at: note.created_at },
    ...(note.replies || []),
  ];

  const getBody = (content: string) => {
    if (!content.startsWith('📋')) return content;
    const lines = content.split('\n');
    const statIdx = lines.findIndex(l => l.includes('👥'));
    return statIdx >= 0 ? lines.slice(statIdx + 1).join('\n').trim() : content;
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.25)' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>{t('dash.thread_title')}</h2>
            <p style={{ fontSize: 12, color: 'var(--fg-2)', margin: '3px 0 0' }}>{note.course_title || ''}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {allMessages.map(msg => {
            const isMe = msg.author_role === 'teacher';
            const color = isMe ? '#8B5CF6' : '#0EA5E9';
            const body = getBody(msg.content);
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: 'var(--fg-2)' }}>{msg.author_name}</span>
                  <span style={{ padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${color}15`, color }}>{msg.author_role}</span>
                  <span>{fmtTime(msg.created_at)}</span>
                </div>
                <div style={{
                  maxWidth: '85%', padding: '11px 15px',
                  borderRadius: isMe ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: isMe ? '#8B5CF612' : '#0EA5E912',
                  border: `1px solid ${color}25`,
                  fontSize: 13, lineHeight: 1.7, color: 'var(--fg)', whiteSpace: 'pre-wrap',
                }}>
                  {body}
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply box */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={reply}
            onChange={e => onReplyChange(e.target.value)}
            placeholder={t('dash.reply_placeholder')}
            rows={3}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, background: 'var(--input-bg)', color: 'var(--fg)', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend(); }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', alignSelf: 'center' }}>{t('dash.reply_hint')}</span>
            <button
              onClick={onSend}
              disabled={sending || !reply.trim()}
              style={{ padding: '8px 20px', background: reply.trim() ? '#0EA5E9' : 'var(--border)', color: reply.trim() ? '#fff' : 'var(--fg-3)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: sending || !reply.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              {sending ? t('common.loading') : t('dash.send_reply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
