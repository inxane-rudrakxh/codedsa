'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

export default function InstructionsPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [testTitle, setTestTitle] = useState('Assessment');
  const [testInstructions, setTestInstructions] = useState('');
  const [testType, setTestType] = useState('CODING');
  const [duration, setDuration] = useState(60);
  const [totalMarks, setTotalMarks] = useState(30);
  const [questionCount, setQuestionCount] = useState(3);

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
          if (data.session.test_title) setTestTitle(data.session.test_title);
          if (data.session.test_instructions) setTestInstructions(data.session.test_instructions);
          if (data.session.test_type) setTestType(data.session.test_type);
          if (data.session.duration_minutes) setDuration(data.session.duration_minutes);
          if (data.session.total_marks) setTotalMarks(data.session.total_marks);
          if (data.questions && data.questions.length > 0) setQuestionCount(data.questions.length);

          const hasAnswers = data.quiz_answers && Object.keys(data.quiz_answers).length > 0;
          const hasSaves = data.saves && Object.keys(data.saves).length > 0;
          const hasSubs = data.submissions && Object.keys(data.submissions).length > 0;

          if (data.session.status === 'active' && (hasAnswers || hasSaves || hasSubs)) {
            router.replace('/exam/workspace');
            return;
          }
        })
        .catch(() => router.push('/'));
    };

    checkSession();
    const interval = setInterval(checkSession, 3000);
    return () => clearInterval(interval);
  }, [router]);

  const handleStart = async () => {
    if (sessionStatus === 'active') {
      try {
        if (typeof document !== 'undefined' && document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn('Could not enter fullscreen automatically:', err);
      }
      router.push('/exam/workspace');
    }
  };

  const isQuiz = testType === 'QUIZ' || testType === 'PUZZLE';

  const dynamicInstructions = isQuiz ? [
    `This test contains ${questionCount} questions for a total of ${totalMarks} marks.`,
    `The exam duration is ${duration} minutes. A live countdown timer is visible throughout the test.`,
    'This is a non-coding assessment covering puzzle problems, output tracing, pointer operations, and conceptual theory.',
    'You can navigate between questions using the Question Palette, answer in any order, and mark questions for review.',
    'Your responses are automatically saved in real time as you type or select options.',
    'Tab-switching and exiting fullscreen are strictly restricted. You have a limit of up to 3 violations — on the 3rd violation, your exam will be automatically submitted immediately.',
    'Ensure you do not open developer tools, inspect element, or attempt copy-pasting from external sources.',
    'Click "Submit Exam" once you have reviewed all your answers. Once submitted, answers cannot be edited.',
  ] : [
    `You will be assigned ${questionCount} questions from the question bank. Your assignment is fixed.`,
    `The exam duration is ${duration} minutes. A countdown timer is visible at all times.`,
    'Write your solutions in C++, C, Python, or Java with syntax highlighting and compiler execution.',
    'Use the "Run Code" button to test your program against visible test cases before submitting.',
    'Tab-switching and exiting fullscreen are restricted. You have a limit of up to 3 violations — on the 3rd violation, your exam will be automatically submitted.',
    'Your code is automatically saved every few seconds to prevent progress loss.',
    `Each question is evaluated independently. Total marks: ${totalMarks}.`,
  ];

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
          fontFamily: 'Söhne Mono, ui-monospace, monospace',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.04em',
        }}>CODE//ZEAL</span>
        {studentName && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>
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
          <div style={{ marginBottom: '40px' }}>
            <p style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '12px',
            }}>{isQuiz ? 'Puzzle & Quiz Test' : 'Coding Assessment'}</p>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              marginBottom: '12px',
            }}>{testTitle}</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {testInstructions || 'Please read the instructions carefully before beginning your test.'}
            </p>
          </div>

          {/* Exam info grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px',
            background: 'var(--border)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '40px',
          }}>
            {[
              { label: 'Total Marks', value: `${totalMarks}` },
              { label: 'Duration', value: `${duration} min` },
              { label: 'Questions', value: `${questionCount}` },
              { label: 'Test Mode', value: isQuiz ? 'Puzzle / Quiz' : 'Coding' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '20px 16px',
                background: 'var(--surface-1)',
              }}>
                <p className="text-label" style={{ marginBottom: '6px' }}>{label}</p>
                <p style={{
                  fontSize: '17px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontFamily: 'Söhne Mono, ui-monospace, monospace',
                  letterSpacing: '-0.02em',
                }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Anti-cheat banner */}
          <div style={{
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '6px',
            padding: '16px 20px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <AlertTriangle size={20} color="#eab308" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                Anti-Cheat Limit: 3 Alt-Tab / Window Switches
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Exiting fullscreen or switching to another application is strictly counted. On the <strong>3rd violation</strong>, your exam will be automatically submitted with your current answers.
              </p>
            </div>
          </div>

          {/* Instructions List */}
          <div style={{ marginBottom: '40px' }}>
            <p className="text-label" style={{ marginBottom: '16px' }}>Guidelines</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dynamicInstructions.map((inst, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <span style={{
                    fontFamily: 'Söhne Mono, ui-monospace, monospace',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    paddingTop: '2px',
                    flexShrink: 0,
                    width: '18px',
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    {inst}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Agreement Checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '32px',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                marginTop: '2px',
                accentColor: 'var(--accent)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              I have read and understood the instructions, anti-cheat regulations, and am ready to begin the test.
            </span>
          </label>

          {sessionStatus === 'pending_approval' ? (
            <div style={{
              width: '100%',
              padding: '16px',
              background: 'var(--warning-dim)',
              border: '1px solid var(--warning)',
              borderRadius: '6px',
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
                Waiting for Faculty Approval...
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Please stay on this screen. Once approved, the button below will activate.
              </span>
            </div>
          ) : (
            <button
              id="begin-exam-btn"
              onClick={handleStart}
              disabled={!checked}
              style={{
                width: '100%',
                padding: '16px',
                background: checked ? 'var(--accent)' : 'var(--surface-2)',
                border: '1px solid transparent',
                borderRadius: '6px',
                color: checked ? '#ffffff' : 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: checked ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                boxShadow: checked ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              }}
            >
              Begin {isQuiz ? 'Quiz & Puzzle' : 'Coding'} Exam
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
