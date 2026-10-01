'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InstructionsPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) {
      router.push('/');
      return;
    }

    const checkSession = () => {
      fetch('/api/exam/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.student) setStudentName(data.student.name);
          if (!data.session || data.session.status === 'expired') {
            router.push('/');
            return;
          }
          setSessionStatus(data.session.status);
          
          if (data.submissions && Object.keys(data.submissions).length > 0) {
            // Still allow going to workspace if they already started
          }
        })
        .catch(() => router.push('/'));
    };

    checkSession();
    const interval = setInterval(checkSession, 3000);
    return () => clearInterval(interval);
  }, [router]);

  const handleStart = () => {
    if (sessionStatus === 'active') {
      router.push('/exam/workspace');
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '20px 40px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.04em',
        }}>CODE//DSA</span>
        {studentName && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {studentName}
          </span>
        )}
      </header>

      <div style={{
        flex: 1,
        maxWidth: '680px',
        margin: '0 auto',
        padding: '60px 24px',
        width: '100%',
      }}>
        <div className="animate-fade-up">
          {/* Title */}
          <div style={{ marginBottom: '48px' }}>
            <p style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '12px',
            }}>Exam Instructions</p>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: '8px',
            }}>DSA — Unit II</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              S.Y. B.Tech AI&DS · Coding Assessment
            </p>
          </div>

          {/* Exam info grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px',
            background: 'var(--border)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '40px',
          }}>
            {[
              { label: 'Total Marks', value: '30' },
              { label: 'Duration', value: '60 min' },
              { label: 'Questions', value: '3 / 9' },
              { label: 'Language', value: 'C++' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '20px 16px',
                background: 'var(--surface-1)',
              }}>
                <p className="text-label" style={{ marginBottom: '6px' }}>{label}</p>
                <p style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div style={{ marginBottom: '40px' }}>
            <p style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '20px',
            }}>Before You Begin</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {instructions.map((item, i) => (
                <div key={i} style={{
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                }}>
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--text-muted)',
                    marginTop: '2px',
                    minWidth: '20px',
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Acknowledgement */}
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            cursor: 'pointer',
            marginBottom: '32px',
            padding: '16px',
            border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '4px',
            background: checked ? 'var(--accent-dim)' : 'transparent',
            transition: 'all 0.15s ease',
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{
                width: '14px',
                height: '14px',
                marginTop: '2px',
                accentColor: 'var(--accent)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              I have read and understood the instructions. I acknowledge that any violation of exam integrity will be recorded.
            </span>
          </label>

          {sessionStatus === 'pending_approval' ? (
            <div style={{
              width: '100%',
              padding: '15px',
              background: 'var(--warning-dim)',
              border: '1px solid var(--warning)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}>
              <span className="spinner" style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--warning)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></span>
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
              <span style={{
                color: 'var(--warning)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                Waiting for Admin Approval...
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Please wait in this lobby. The exam will start automatically.
              </span>
            </div>
          ) : (
            <button
              id="begin-exam-btn"
              onClick={handleStart}
              disabled={!checked}
              style={{
                width: '100%',
                padding: '15px',
                background: checked ? 'var(--text-primary)' : 'var(--surface-2)',
                border: '1px solid transparent',
                borderRadius: '4px',
                color: checked ? 'var(--bg)' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: checked ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
            >
              Begin Exam
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

const instructions = [
  'You will be assigned exactly 3 questions from the question bank. Your assignment is fixed — refreshing the page will not change your questions.',
  'The exam duration is 60 minutes. A countdown timer is visible at all times. The exam auto-submits when time expires.',
  'Write your solutions in C++17. A Monaco code editor with syntax highlighting is provided for each question.',
  'Use the "Run Code" button to test your program against visible test cases before submitting. Each question is evaluated independently.',
  'Click "Submit" for each question individually when you are satisfied with your solution. Submitted questions cannot be edited.',
  'Your code is automatically saved every few seconds. If you accidentally close the tab, your work will be restored.',
  'Do not switch browser tabs or exit fullscreen during the exam. These actions are detected and recorded as integrity events.',
  'Each question is worth 10 marks (Total: 30). Scoring is based on test case passage — partial credit is awarded.',
  'Do not refresh the page unnecessarily. Your session and timer persist on the server and will not reset.',
  'Ensure you have a stable internet connection before starting. Network interruptions may affect code submission.',
];
