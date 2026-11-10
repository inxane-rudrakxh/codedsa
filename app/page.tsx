'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck, Monitor, AlertCircle } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const [testCode, setTestCode] = useState('');
  const [error, setError] = useState('');

  const handleEnterTest = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = testCode.trim();
    if (!trimmed) {
      setError('Please enter a valid assessment code or link.');
      return;
    }
    setError('');

    // Handle full URL pasted or just slug
    let slug = trimmed;
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        slug = url.pathname.replace(/^\/+/, '');
      }
    } catch {}

    router.push(`/${encodeURIComponent(slug)}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      {/* Top Header */}
      <header style={{
        height: '64px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        background: 'var(--surface-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-primary)',
          }}>
            CODE//ZEAL
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            padding: '2px 8px',
            background: 'var(--surface-2)',
            borderRadius: '4px',
            border: '1px solid var(--border)',
          }}>
            Examination Engine
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--success)',
          }} />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            System Operational
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          {/* Hero Card */}
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '36px 32px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
          }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}>
                <ShieldCheck size={15} />
                Secure Assessment Portal
              </div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: '8px',
              }}>
                Enter Assessment Code
              </h1>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                Enter the unique test code or paste the link provided by your course faculty to launch your assessment environment.
              </p>
            </div>

            <form onSubmit={handleEnterTest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <input
                  type="text"
                  value={testCode}
                  onChange={(e) => {
                    setTestCode(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. test-d-bfddb0 or unit-3-linked-lists"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '14px',
                    fontFamily: 'Söhne Mono, ui-monospace, monospace',
                    background: 'var(--bg)',
                    border: error ? '1px solid var(--error)' : '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                />
                {error && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    fontSize: '12px',
                    color: 'var(--error)',
                  }}>
                    <AlertCircle size={13} />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent)')}
              >
                Launch Assessment
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          {/* Guidelines Box */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              letterSpacing: '0.04em',
            }}>
              <Monitor size={14} />
              Examination Environment Guidelines
            </div>
            <ul style={{
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
            }}>
              <li>• Fullscreen mode and continuous integrity monitoring will be active.</li>
              <li>• Switching tabs or minimizing the test window will trigger integrity alerts.</li>
              <li>• Ensure stable internet connectivity throughout the examination duration.</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        height: '48px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        background: 'var(--surface-1)',
      }}>
        <p style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          fontFamily: 'Söhne Mono, ui-monospace, monospace',
        }}>
          Zeal College of Engineering & Research • Department of AI & Data Science
        </p>
      </footer>
    </div>
  );
}
