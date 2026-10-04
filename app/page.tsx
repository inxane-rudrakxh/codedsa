'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface StudentInfo {
  roll_no: string;
  name: string;
  division: string;
  branch: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm'>('input');

  const handleLookup = async () => {
    if (!rollNo.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_no: rollNo.trim(), action: 'lookup' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Roll number not found.');
        setStudent(null);
        return;
      }
      setStudent(data.student);
      setStep('confirm');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_no: rollNo.trim(), password, action: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      localStorage.setItem('session_token', data.session_token);
      router.push('/exam/instructions');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'input') handleLookup();
      else if (step === 'confirm' && password) handleStart();
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          padding: '20px 40px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
          }}
        >
          CODE//ZEAL
        </span>
        <span className="text-label">S.Y. B.Tech AI&DS</span>
      </header>

      {/* Center content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
        }}
      >
        <div
          className="animate-fade-up"
          style={{
            width: '100%',
            maxWidth: '420px',
          }}
        >
          {/* Brand block */}
          <div style={{ marginBottom: '56px' }}>
            <h1
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '48px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                marginBottom: '12px'
              }}
            >
              CODE//ZEAL
            </h1>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: '4px',
              }}
            >
              Unit II · Coding Assessment
            </p>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              S.Y. B.Tech AI&DS
            </p>
          </div>

          {/* Form */}
          {step === 'input' ? (
            <div>
              <label
                htmlFor="roll-number"
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '10px',
                }}
              >
                Roll Number
              </label>
              <input
                id="roll-number"
                type="text"
                value={rollNo}
                onChange={(e) => {
                  setRollNo(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--surface-1)',
                  border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.08em',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                  marginBottom: '8px',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? 'var(--error)' : 'var(--border)';
                }}
              />
              {error && (
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--error)',
                    marginBottom: '8px',
                    letterSpacing: '0.02em',
                  }}
                >
                  {error}
                </p>
              )}
              <button
                id="continue-btn"
                onClick={handleLookup}
                disabled={loading || !rollNo.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  marginTop: '8px',
                  background: loading || !rollNo.trim() ? 'var(--surface-2)' : 'var(--accent)',
                  border: '1px solid transparent',
                  borderRadius: '4px',
                  color: loading || !rollNo.trim() ? 'var(--text-muted)' : '#000',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: loading || !rollNo.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: 'none',
                }}
                onMouseOver={(e) => {
                  if (!loading && rollNo.trim()) {
                    e.currentTarget.style.background = 'var(--accent-hover)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading && rollNo.trim()) {
                    e.currentTarget.style.background = 'var(--accent)';
                  }
                }}
              >
                {loading ? 'Searching...' : 'Continue'}
              </button>
            </div>
          ) : (
            <div className="animate-fade-up">
              {/* Student card */}
              <div
                className="glass-panel"
                style={{
                  padding: '24px',
                  marginBottom: '20px',
                  background: 'var(--surface-1)'
                }}
              >
                <p className="text-label" style={{ marginBottom: '16px' }}>
                  Student Verified
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                  }}
                >
                  <InfoField label="Name" value={student!.name} />
                  <InfoField label="Roll No" value={student!.roll_no} />
                  <InfoField label="Division" value={student!.division} />
                  <InfoField label="Branch" value={student!.branch} />
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="password"
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: '10px',
                  }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'var(--surface-1)',
                    border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={(e) => { e.target.style.borderColor = error ? 'var(--error)' : 'var(--border)'; }}
                />
              </div>

              {error && (
                <p style={{ fontSize: '12px', color: 'var(--error)', marginBottom: '12px' }}>
                  {error}
                </p>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setStep('input');
                    setStudent(null);
                    setError('');
                  }}
                  style={{
                    flex: 1,
                    padding: '13px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Back
                </button>
                <button
                  id="start-exam-btn"
                  onClick={handleStart}
                  disabled={loading || !password}
                  style={{
                    flex: 2,
                    padding: '13px',
                    background: loading || !password ? 'var(--surface-2)' : 'var(--success)',
                    border: '1px solid transparent',
                    borderRadius: '4px',
                    color: loading || !password ? 'var(--text-muted)' : '#000',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: 'none'
                  }}
                  onMouseOver={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = '#0ea5e9'; // A bit brighter
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = 'var(--success)';
                    }
                  }}
                >
                  {loading ? 'Starting...' : 'Start Exam'}
                </button>
              </div>
            </div>
          )}

          {/* Footer info */}
          <div
            style={{
              marginTop: '48px',
              paddingTop: '24px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '24px',
            }}
          >
            {[
              { label: 'Platform', value: 'Multi-Lang' },
              { label: 'Duration', value: '60 Min' },
              { label: 'Marks', value: '30' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-label" style={{ marginBottom: '2px' }}>{label}</p>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      

    </main>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label" style={{ marginBottom: '3px' }}>{label}</p>
      <p
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.02em',
        }}
      >
        {value}
      </p>
    </div>
  );
}
