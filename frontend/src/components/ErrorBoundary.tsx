'use client';

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
          <h2 style={{
            fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700,
            color: 'var(--fg)', marginBottom: 8,
          }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--fg-2)', fontSize: 14, maxWidth: 380, lineHeight: 1.6, marginBottom: 24 }}>
            An unexpected error occurred. You can try refreshing this section or go back to the dashboard.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                border: 'none', borderRadius: 10,
                color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign('/dashboard')}
              style={{
                padding: '10px 20px', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 10,
                color: 'var(--fg-2)', fontSize: 14, cursor: 'pointer',
              }}
            >
              Go to dashboard
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: 24, textAlign: 'start', maxWidth: 600, width: '100%' }}>
              <summary style={{ color: 'var(--fg-3)', fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                Error details (dev only)
              </summary>
              <pre style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 16, fontSize: 12,
                color: '#F87171', overflowX: 'auto', whiteSpace: 'pre-wrap',
              }}>
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
