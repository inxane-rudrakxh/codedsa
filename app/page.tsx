'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm' | 'waiting' | 'rejected'>('input');
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleLookup = async () => {
    if (!rollNo.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_no: rollNo.trim().toUpperCase(), action: 'lookup' }),
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
        body: JSON.stringify({ roll_no: rollNo.trim().toUpperCase(), action: 'request_access' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes('rejected')) {
           setStep('rejected');
           return;
        }
        setError(data.error || 'Request failed.');
        return;
      }
      
      if (data.status === 'ACTIVE') {
        // If they were already approved previously
        checkStatus();
      } else if (data.status === 'REJECTED') {
        setStep('rejected');
      } else {
        setStep('waiting');
        startPolling();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(checkStatus, 2000);
  };

  const checkStatus = async () => {
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_no: rollNo.trim().toUpperCase(), action: 'check_status' }),
      });
      const data = await res.json();
      
      if (data.status === 'ACTIVE' && data.session_token) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        localStorage.setItem('session_token', data.session_token);
        router.push('/exam/instructions');
      } else if (data.status === 'REJECTED') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setStep('rejected');
      }
    } catch {
      // silently ignore network errors during polling
    }
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'input') handleLookup();
      else if (step === 'confirm') handleStart();
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

          {step === 'input' && (
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
                  setRollNo(e.target.value.toUpperCase());
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
              >
                {loading ? 'Searching...' : 'Continue'}
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div className="animate-fade-up">
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
                  disabled={loading}
                  style={{
                    flex: 2,
                    padding: '13px',
                    background: loading ? 'var(--surface-2)' : 'var(--success)',
                    border: '1px solid transparent',
                    borderRadius: '4px',
                    color: loading ? 'var(--text-muted)' : '#000',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {loading ? 'Requesting...' : 'Request Access'}
                </button>
              </div>
            </div>
          )}

          {step === 'waiting' && (
            <div className="animate-fade-up text-center" style={{ textAlign: 'center' }}>
              <div
                className="glass-panel"
                style={{
                  padding: '32px 24px',
                  background: 'var(--surface-1)'
                }}
              >
                <div style={{ marginBottom: '24px' }}>
                  <div className="animate-pulse-subtle" style={{ width: '12px', height: '12px', background: 'var(--warning)', borderRadius: '50%', margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Verification Required
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Your attendance request has been sent to the teacher. Please wait for approval.
                  </p>
                </div>
                
                <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: '4px', textAlign: 'left', marginBottom: '24px' }}>
                  <p className="text-label" style={{ marginBottom: '12px' }}>Request Details</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Roll Number</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{student?.roll_no}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Name</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{student?.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Division</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{student?.division}</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>●</span> Waiting for teacher approval
                </p>
              </div>
            </div>
          )}

          {step === 'rejected' && (
            <div className="animate-fade-up text-center" style={{ textAlign: 'center' }}>
              <div
                className="glass-panel"
                style={{
                  padding: '32px 24px',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--error-dim)'
                }}
              >
                <div style={{ width: '48px', height: '48px', background: 'var(--error-dim)', color: 'var(--error)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  ✕
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--error)', marginBottom: '8px' }}>
                  Verification Rejected
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Your attendance/entry request was rejected by the teacher. Please contact your teacher if this was a mistake.
                </p>
                <button
                  onClick={() => setStep('input')}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  Start Over
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
