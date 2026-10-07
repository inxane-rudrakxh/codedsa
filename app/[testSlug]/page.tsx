'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function StudentTestPage() {
  const router = useRouter();
  const params = useParams();
  const testSlug = params.testSlug as string;

  const [testData, setTestData] = useState<any>(null);
  const [loadingTest, setLoadingTest] = useState(true);
  const [testError, setTestError] = useState('');

  const [rollNo, setRollNo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'waiting' | 'rejected'>('input');
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function loadTest() {
      try {
        const res = await fetch(`/api/public/test/${testSlug}`);
        const data = await res.json();
        if (!res.ok) {
          setTestError(data.error || 'Assessment Not Found');
          return;
        }
        setTestData(data.test);
      } catch (err) {
        setTestError('Network Error');
      } finally {
        setLoadingTest(false);
      }
    }
    loadTest();
  }, [testSlug]);

  const handleStart = async () => {
    if (!rollNo.trim()) {
      setError('Please enter your Roll Number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roll_no: rollNo.trim().toUpperCase(), action: 'request_access', test_id: testSlug }),
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
        body: JSON.stringify({ roll_no: rollNo.trim().toUpperCase(), action: 'check_status', test_id: testSlug }),
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
      if (step === 'input') handleStart();
    }
  };

  if (loadingTest) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>Loading Assessment...</p>
      </main>
    );
  }

  if (testError) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            {testError.split('\n')[0]}
          </h1>
          {testError.split('\n')[1] && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
              {testError.split('\n')[1]}
            </p>
          )}
        </div>
      </main>
    );
  }

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
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
          }}
        >
          CODE//ZEAL
        </span>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: '440px', width: '100%' }}>
          
          <div style={{ marginBottom: '32px' }}>
            <h1
              style={{
                fontFamily: 'Copernicus, ui-serif, serif',
                fontSize: '32px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                marginBottom: '8px'
              }}
            >
              {testData.title}
            </h1>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--text-secondary)',
                fontWeight: 400
              }}
            >
              Online Coding Assessment
            </p>
          </div>

          <div
            style={{
              padding: '20px 0',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              marginBottom: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Duration</span>
               <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{testData.duration_minutes} Minutes</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Questions</span>
               <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{testData.question_count}</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Marks</span>
               <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{testData.total_marks}</span>
             </div>
          </div>

          {step === 'input' && (
            <div className="animate-fade-up">
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Roll Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. AD1306"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '16px',
                    fontFamily: 'Söhne Mono, ui-monospace, monospace',
                    transition: 'border-color 0.2s ease',
                    textTransform: 'uppercase'
                  }}
                  autoFocus
                />
              </div>

              {error && (
                <p style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '16px' }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleStart}
                disabled={loading || !rollNo.trim()}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading || !rollNo.trim() ? 'var(--primary-disabled)' : 'var(--accent)',
                  border: '1px solid transparent',
                  borderRadius: '6px',
                  color: loading || !rollNo.trim() ? 'var(--text-muted)' : '#ffffff',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: loading || !rollNo.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'Söhne, ui-sans-serif, system-ui, sans-serif',
                }}
              >
                {loading ? 'Requesting...' : 'Request Access'}
              </button>
            </div>
          )}

          {step === 'waiting' && (
            <div className="animate-fade-up">
              <div
                style={{
                  padding: '32px 24px',
                  background: 'var(--surface-1)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                  <div className="animate-pulse-subtle" style={{ width: '12px', height: '12px', background: 'var(--warning)', borderRadius: '50%', margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    ACCESS REQUEST SENT
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Your request has been sent to the Admin.<br />Please keep this page open.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: '4px', textAlign: 'left', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Roll Number</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>{rollNo}</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>●</span> Waiting for approval...
                </p>
              </div>
            </div>
          )}

          {step === 'rejected' && (
            <div className="animate-fade-up text-center">
              <div
                style={{
                  padding: '32px 24px',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--error-dim)',
                  borderRadius: '8px'
                }}
              >
                <div style={{ width: '48px', height: '48px', background: 'var(--error-dim)', color: 'var(--error)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  ✕
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--error)', marginBottom: '8px' }}>
                  ACCESS DENIED
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
                  Your request was not approved by the Admin.<br />Please contact the Admin if you believe this is an error.
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
        </div>
      </div>
    </main>
  );
}
