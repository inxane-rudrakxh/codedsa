'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Question {
  id: number;
  title: string;
  topic: string;
  statement: string;
  input_format: string;
  output_format: string;
  constraints: string;
  example_input: string;
  example_output: string;
  order_index: number;
}

interface TestCaseResult {
  test_case_id: number;
  input: string;
  expected_output: string;
  actual_output: string;
  passed: boolean;
  execution_time: number;
  type: string;
  is_visible: number;
}

interface Submission {
  score: number;
  submitted_at: string;
}

interface SessionData {
  session: {
    id: string;
    status: string;
    is_submitted: number;
    remaining_seconds: number;
    integrity_warnings: number;
    is_demo?: boolean;
    demo_config?: {
      demo_rolls: string[];
      questions: Record<string, { keyword: string; solution: string; delay: number }>;
    };
  };
  student: { roll_no: string; name: string; division: string };
  questions: Question[];
  submissions: Record<number, Submission>;
  saves: Record<number, string>;
  testCases: Record<number, Array<{ input: string; expected_output: string; type: string }>>;
}

const STARTER_CODE = `#include <iostream>
using namespace std;

int main() {
    
    return 0;
}`;

const demoBtnStyle = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  color: 'var(--text-secondary)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  fontFamily: 'inherit',
};

export default function WorkspacePage() {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [runResults, setRunResults] = useState<{
    compile_error?: string;
    test_results: TestCaseResult[];
    passed: number;
    total: number;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [integrityWarning, setIntegrityWarning] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [submitScores, setSubmitScores] = useState<Record<number, number>>({});
  const [showFinalScreen, setShowFinalScreen] = useState(false);
  
  // Demo Mode State
  const [demoActive, setDemoActive] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tokenRef = useRef<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getToken = useCallback(() => {
    if (!tokenRef.current) {
      tokenRef.current = localStorage.getItem('session_token') || '';
    }
    return tokenRef.current;
  }, []);

  // Load session data
  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) { router.push('/'); return; }
    tokenRef.current = token;

    fetch('/api/exam/session', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: SessionData) => {
        if (!data.session || data.session.status === 'expired') {
          router.push('/result');
          return;
        }
        if (data.session.is_submitted) {
          setShowFinalScreen(true);
        }
        setSessionData(data);
        setTimeRemaining(data.session.remaining_seconds);
        setWarningCount(data.session.integrity_warnings);

        // Initialize codes from saves
        const initialCodes: Record<number, string> = {};
        data.questions.forEach(q => {
          initialCodes[q.id] = data.saves[q.id] || STARTER_CODE;
        });
        setCodes(initialCodes);

        // Restore submission scores
        const scores: Record<string, number> = {};
        Object.entries(data.submissions).forEach(([qid, sub]) => {
          scores[qid] = sub.score;
        });
        setSubmitScores(scores);

        setLoading(false);
      })
      .catch(() => router.push('/'));
  }, [router]);

  // Handle active question change
  useEffect(() => {
    setDemoActive(false);
    setDemoPlaying(false);
    setDemoCode('');
    setDemoIndex(0);
  }, [activeQuestion]);

  // Demo playback loop
  useEffect(() => {
    if (!demoActive || !demoPlaying || !sessionData?.session.demo_config) return;
    const currentQuestion = sessionData.questions[activeQuestion];
    const demoSetup = sessionData.session.demo_config.questions[currentQuestion.id];
    if (!demoSetup) return;

    const solutionLines = demoSetup.solution.split('\n');
    if (demoIndex >= solutionLines.length) {
      setDemoPlaying(false);
      return;
    }

    const timer = setTimeout(() => {
      setDemoCode(prev => prev + (prev ? '\n' : '') + solutionLines[demoIndex]);
      setDemoIndex(prev => prev + 1);
    }, demoSetup.delay || 500);

    return () => clearTimeout(timer);
  }, [demoActive, demoPlaying, demoIndex, sessionData, activeQuestion]);

  // Timer countdown
  useEffect(() => {
    if (!sessionData || loading) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionData, loading]);

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!sessionData || loading) return;

    const autoSave = () => {
      const question = sessionData.questions[activeQuestion];
      if (!question) return;
      const code = codes[question.id];
      if (!code) return;

      // Don't save if already submitted
      if (sessionData.submissions[question.id]) return;

      fetch('/api/exam/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ question_id: question.id, code }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) setSavedAt(new Date());
        })
        .catch(() => {});
    };

    saveTimerRef.current = setInterval(autoSave, 5000);
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current); };
  }, [sessionData, activeQuestion, codes, loading, getToken]);

  // Integrity monitoring
  useEffect(() => {
    if (!sessionData) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportIntegrity('tab_hidden');
      }
    };

    const handleBlur = () => {
      reportIntegrity('window_blur');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sessionData]);

  const reportIntegrity = async (event_type: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/integrity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event_type }),
      });
      const data = await res.json();
      setWarningCount(data.warnings);
      setIntegrityWarning(`Leaving the exam window has been detected.`);
      setTimeout(() => setIntegrityWarning(null), 5000);
    } catch {}
  };

  const handleAutoSubmit = async () => {
    // Auto-submit all non-submitted questions
    if (!sessionData) return;
    for (const q of sessionData.questions) {
      if (!sessionData.submissions[q.id]) {
        await doSubmit(q.id, codes[q.id] || STARTER_CODE);
      }
    }
    router.push('/result');
  };

  const handleRunCode = async () => {
    if (!sessionData) return;
    const question = sessionData.questions[activeQuestion];
    if (!question) return;

    const code = codes[question.id] || STARTER_CODE;
    setRunning(true);
    setRunResults(null);

    try {
      const res = await fetch('/api/exam/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ question_id: question.id, code }),
      });
      const data = await res.json();
      setRunResults(data);
      setConsoleOpen(true);
    } catch (err) {
      setRunResults({ compile_error: 'Network error', test_results: [], passed: 0, total: 0 });
    } finally {
      setRunning(false);
    }
  };

  const doSubmit = async (questionId: number, code: string): Promise<number> => {
    const res = await fetch('/api/exam/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ question_id: questionId, code }),
    });
    const data = await res.json();
    if (data.success) {
      setSubmitScores(prev => ({ ...prev, [questionId]: data.score ?? 0 }));
      if (data.all_submitted) {
        setTimeout(() => router.push('/result'), 1500);
      }
      return data.score ?? 0;
    }
    return 0;
  };

  const handleSubmitQuestion = async () => {
    if (!sessionData) return;
    const question = sessionData.questions[activeQuestion];
    if (!question) return;

    setSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      const code = codes[question.id] || STARTER_CODE;
      await doSubmit(question.id, code);
      // Update local session data
      setSessionData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          submissions: {
            ...prev.submissions,
            [question.id]: { score: submitScores[question.id] || 0, submitted_at: new Date().toISOString() },
          },
        };
      });
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timerState = timeRemaining > 600 ? 'normal' : timeRemaining > 300 ? 'warning' : 'critical';
  const timerColor = timerState === 'normal' ? 'var(--text-secondary)' : timerState === 'warning' ? 'var(--warning)' : 'var(--error)';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading exam...
          </p>
        </div>
      </div>
    );
  }

  if (!sessionData) return null;

  const currentQuestion = sessionData.questions[activeQuestion];
  const isSubmitted = currentQuestion && !!sessionData.submissions[currentQuestion.id];

  if (showFinalScreen || (sessionData.session.is_submitted && Object.keys(sessionData.submissions).length === sessionData.questions.length)) {
    const totalScore = Object.values(submitScores).reduce((a, b) => a + b, 0);
    return (
      <FinalScreen
        student={sessionData.student}
        questions={sessionData.questions}
        submissions={sessionData.submissions}
        submitScores={submitScores}
        totalScore={totalScore}
      />
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Top Bar */}
      <TopBar
        student={sessionData.student}
        timeRemaining={timeRemaining}
        timerColor={timerColor}
        timerState={timerState}
        savedAt={savedAt}
        warningCount={warningCount}
      />

      {/* Integrity Warning */}
      {integrityWarning && (
        <div style={{
          background: 'var(--warning-dim)',
          borderBottom: '1px solid var(--warning)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--warning)' }}>
              EXAM INTEGRITY WARNING
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{integrityWarning}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--warning)', fontFamily: 'JetBrains Mono, monospace' }}>
            Warnings: {warningCount} / 3
          </span>
        </div>
      )}

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar - Question navigation */}
        <aside style={{
          width: '200px',
          minWidth: '200px',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-1)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <p className="text-label">Questions</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {sessionData.questions.map((q, index) => {
              const submitted = !!sessionData.submissions[q.id];
              const active = index === activeQuestion;
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestion(index)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '4px',
                    background: active ? 'var(--surface-2)' : 'transparent',
                    border: `1px solid ${active ? 'var(--border)' : 'transparent'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: 500,
                    }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <StatusBadge submitted={submitted} active={active} />
                  </div>
                  <p style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    lineHeight: 1.3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {q.title}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Scores summary */}
          <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
            <p className="text-label" style={{ marginBottom: '8px' }}>Score</p>
            {sessionData.questions.map((q, i) => (
              <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Q{i + 1}</span>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: submitScores[q.id] !== undefined ? 'var(--success)' : 'var(--text-muted)',
                }}>
                  {submitScores[q.id] !== undefined ? `${submitScores[q.id]}/10` : '—'}
                </span>
              </div>
            ))}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Total</span>
              <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {Object.values(submitScores).reduce((a, b) => a + b, 0)}/30
              </span>
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {currentQuestion && (
            <>
              {/* Question + Editor split */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Question Panel */}
                <div style={{
                  width: '42%',
                  minWidth: '320px',
                  borderRight: '1px solid var(--border)',
                  overflowY: 'auto',
                  padding: '28px 24px',
                }}>
                  <QuestionPanel question={currentQuestion} index={activeQuestion} />
                </div>

                {/* Editor Panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Editor header */}
                  <div style={{
                    height: '40px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                    background: 'var(--surface-1)',
                    flexShrink: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        main.cpp
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '2px' }}>
                        C++17
                      </span>
                    </div>
                    {isSubmitted ? (
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600, letterSpacing: '0.08em' }}>
                        ✓ SUBMITTED · {submitScores[currentQuestion.id] ?? 0}/10
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setCodes(prev => ({ ...prev, [currentQuestion.id]: STARTER_CODE }));
                        }}
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          letterSpacing: '0.04em',
                          padding: '4px 8px',
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Monaco Editor */}
                  <div 
                    style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
                    onCopy={e => { e.preventDefault(); setIntegrityWarning("Copying is disabled during the exam."); setTimeout(() => setIntegrityWarning(null), 3000); }}
                    onPaste={e => { e.preventDefault(); setIntegrityWarning("Pasting is disabled during the exam."); setTimeout(() => setIntegrityWarning(null), 3000); }}
                    onCut={e => { e.preventDefault(); }}
                    onContextMenu={e => e.preventDefault()}
                  >
                    <MonacoEditor
                      height="100%"
                      language="cpp"
                      theme="vs-dark"
                      value={demoActive ? demoCode : (codes[currentQuestion.id] || STARTER_CODE)}
                      onChange={(val) => {
                        if (isSubmitted) return;
                        
                        // Demo Mode intercept
                        if (sessionData?.session.is_demo && sessionData.session.demo_config) {
                          const demoSetup = sessionData.session.demo_config.questions[currentQuestion.id];
                          if (demoSetup && val?.trim() === demoSetup.keyword) {
                            setDemoActive(true);
                            setDemoPlaying(true);
                            setDemoCode('');
                            setDemoIndex(0);
                            return;
                          }
                        }

                        if (demoActive) {
                          // Allow editing demo code? Or just disable it?
                          // The user shouldn't edit during playback, but if they do, we can just update demoCode.
                          setDemoCode(val || '');
                          return;
                        }

                        setCodes(prev => ({ ...prev, [currentQuestion.id]: val || '' }));
                      }}
                      options={{
                        readOnly: isSubmitted,
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontLigatures: true,
                        lineNumbers: 'on',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: 'on',
                        renderLineHighlight: 'line',
                        scrollbar: {
                          verticalScrollbarSize: 4,
                          horizontalScrollbarSize: 4,
                        },
                        padding: { top: 16, bottom: 16 },
                        bracketPairColorization: { enabled: true },
                        formatOnPaste: true,
                        autoIndent: 'advanced',
                        suggest: { showKeywords: true },
                      }}
                      onMount={(editor, monaco) => {
                        // Ctrl+Enter → Run Code
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                          if (!isSubmitted) handleRunCode();
                        });
                      }}
                    />
                  </div>

                  {/* Action bar */}
                  {!isSubmitted && (
                    <div style={{
                      height: '48px',
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '0 16px',
                      background: 'var(--surface-1)',
                      flexShrink: 0,
                    }}>
                      {demoActive ? (
                        <>
                          <div style={{ padding: '4px 8px', background: 'var(--accent)', color: 'white', fontSize: '10px', fontWeight: 700, borderRadius: '2px', letterSpacing: '0.05em' }}>
                            DEMO MODE — SOLUTION PREVIEW
                          </div>
                          <button onClick={() => setDemoPlaying(p => !p)} style={demoBtnStyle}>
                            {demoPlaying ? 'Pause' : 'Play'}
                          </button>
                          <button onClick={() => { setDemoCode(''); setDemoIndex(0); setDemoPlaying(true); }} style={demoBtnStyle}>
                            Replay
                          </button>
                          <button onClick={() => { 
                            const demoSetup = sessionData.session.demo_config?.questions[currentQuestion.id];
                            if(demoSetup) { setDemoCode(demoSetup.solution); setDemoIndex(demoSetup.solution.split('\n').length); setDemoPlaying(false); }
                          }} style={demoBtnStyle}>
                            Show Complete
                          </button>
                          <button onClick={() => setDemoActive(false)} style={{...demoBtnStyle, marginLeft: 'auto', border: '1px solid var(--error)', color: 'var(--error)'}}>
                            Exit Demo
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            id="run-code-btn"
                            onClick={handleRunCode}
                            disabled={running || submitting}
                            style={{
                              padding: '8px 20px',
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: '3px',
                              color: running ? 'var(--text-muted)' : 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.10em',
                              textTransform: 'uppercase',
                              cursor: running ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                              fontFamily: 'inherit',
                            }}
                          >
                            {running ? '◌ Running...' : '▷ Run Code'}
                          </button>

                          <button
                            id="submit-btn"
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={submitting || running}
                            style={{
                              padding: '8px 20px',
                              background: submitting ? 'var(--surface-2)' : 'var(--accent)',
                              border: '1px solid transparent',
                              borderRadius: '3px',
                              color: submitting ? 'var(--text-muted)' : '#fff',
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.10em',
                              textTransform: 'uppercase',
                              cursor: submitting ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                              fontFamily: 'inherit',
                            }}
                          >
                            {submitting ? 'Submitting...' : 'Submit'}
                          </button>

                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            Ctrl+Enter to run
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Console */}
                  <ConsolePanel
                    open={consoleOpen}
                    onToggle={() => setConsoleOpen(p => !p)}
                    results={runResults}
                    running={running}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <Modal
          onClose={() => setShowSubmitConfirm(false)}
          onConfirm={handleSubmitQuestion}
          questionTitle={currentQuestion?.title || ''}
        />
      )}
    </div>
  );
}

// Sub-components
function TopBar({
  student,
  timeRemaining,
  timerColor,
  timerState,
  savedAt,
  warningCount,
}: {
  student: { roll_no: string; name: string; division: string };
  timeRemaining: number;
  timerColor: string;
  timerState: string;
  savedAt: Date | null;
  warningCount: number;
}) {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const [saveLabel, setSaveLabel] = useState('');
  useEffect(() => {
    if (!savedAt) return;
    const update = () => {
      const seconds = Math.round((Date.now() - savedAt.getTime()) / 1000);
      setSaveLabel(seconds < 5 ? 'Saved' : `Saved ${seconds}s ago`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [savedAt]);

  return (
    <header style={{
      height: '48px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '24px',
      background: 'var(--surface-1)',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        letterSpacing: '0.04em',
      }}>CODE//DSA</span>

      <div style={{ height: '16px', width: '1px', background: 'var(--border)' }} />

      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>S.Y. B.Tech AI&DS</span>

      <div style={{ height: '16px', width: '1px', background: 'var(--border)' }} />

      <span style={{
        fontSize: '12px',
        color: 'var(--text-secondary)',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {student.roll_no} · {student.name}
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {savedAt && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            {saveLabel}
          </span>
        )}

        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '16px',
            fontWeight: 600,
            color: timerColor,
            letterSpacing: '0.04em',
            transition: 'color 0.5s ease',
          }}
          className={timerState === 'critical' ? 'timer-critical' : ''}
        >
          {formatTime(timeRemaining)}
        </span>
      </div>
    </header>
  );
}

function StatusBadge({ submitted, active }: { submitted: boolean; active: boolean }) {
  if (submitted) {
    return (
      <span style={{
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: 'var(--success)',
        fontFamily: 'JetBrains Mono, monospace',
      }}>✓</span>
    );
  }
  return (
    <span style={{
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: active ? 'var(--accent)' : 'var(--border)',
      display: 'inline-block',
    }} />
  );
}

function QuestionPanel({ question, index }: { question: Question; index: number }) {
  return (
    <div>
      {/* Question header */}
      <div style={{ marginBottom: '28px' }}>
        <p style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: '6px',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          Q{String(index + 1).padStart(2, '0')} · {question.topic}
        </p>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}>
          {question.title}
        </h2>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', marginBottom: '24px' }} />

      {/* Problem statement */}
      <Section label="Problem">
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {question.statement}
        </p>
      </Section>

      <Section label="Input Format">
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {question.input_format}
        </p>
      </Section>

      <Section label="Output Format">
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {question.output_format}
        </p>
      </Section>

      <Section label="Constraints">
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {question.constraints}
        </p>
      </Section>

      {/* Example */}
      <div style={{ marginBottom: '20px' }}>
        <p className="text-label" style={{ marginBottom: '12px' }}>Example</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.06em' }}>INPUT</p>
            <pre style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              background: 'var(--surface-2)',
              padding: '10px 12px',
              borderRadius: '3px',
              border: '1px solid var(--border)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              margin: 0,
            }}>{question.example_input}</pre>
          </div>
          <div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.06em' }}>OUTPUT</p>
            <pre style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              background: 'var(--surface-2)',
              padding: '10px 12px',
              borderRadius: '3px',
              border: '1px solid var(--border)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              margin: 0,
            }}>{question.example_output}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <p className="text-label" style={{ marginBottom: '8px' }}>{label}</p>
      {children}
    </div>
  );
}

function ConsolePanel({
  open,
  onToggle,
  results,
  running,
}: {
  open: boolean;
  onToggle: () => void;
  results: {
    compile_error?: string;
    test_results: TestCaseResult[];
    passed: number;
    total: number;
  } | null;
  running: boolean;
}) {
  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      background: 'var(--surface-1)',
      flexShrink: 0,
    }}>
      {/* Console header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '8px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
          Console
        </span>
        {results && !results.compile_error && (
          <span style={{
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            color: results.passed === results.total ? 'var(--success)' : 'var(--warning)',
            fontWeight: 600,
          }}>
            {results.passed}/{results.total} passed
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '10px' }}>{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '0 16px 12px' }}>
          {running && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', padding: '8px 0' }}>
              ◌ Compiling and running...
            </p>
          )}

          {results?.compile_error && (
            <div style={{
              padding: '12px',
              background: 'var(--error-dim)',
              border: '1px solid var(--error)',
              borderRadius: '3px',
              marginBottom: '8px',
            }}>
              <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', color: 'var(--error)', marginBottom: '6px' }}>
                COMPILATION ERROR
              </p>
              <pre style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: 'var(--error)',
                whiteSpace: 'pre-wrap',
                margin: 0,
                lineHeight: 1.6,
              }}>{results.compile_error}</pre>
            </div>
          )}

          {results && !results.compile_error && results.test_results.length > 0 && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Test Results
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {results.test_results.map((tc, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '8px 12px',
                    background: tc.passed ? 'var(--success-dim)' : 'var(--error-dim)',
                    borderRadius: '4px',
                    border: `1px solid ${tc.passed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontSize: '12px',
                        color: tc.passed ? 'var(--success)' : 'var(--error)',
                        fontWeight: 700,
                        minWidth: '12px',
                      }}>
                        {tc.passed ? '✓' : '✕'}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        fontFamily: 'JetBrains Mono, monospace',
                        flex: 1,
                      }}>
                        Test Case {i + 1}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        color: tc.passed ? 'var(--success)' : 'var(--error)',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                      }}>
                        {tc.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                    
                    {!tc.passed && (
                      <div style={{ 
                        marginTop: '8px', 
                        paddingTop: '8px', 
                        borderTop: '1px solid rgba(239,68,68,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input:</span>
                          <pre style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>{tc.input || '(no input)'}</pre>
                        </div>
                        <div>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected Output:</span>
                          <pre style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--success)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>{tc.expected_output}</pre>
                        </div>
                        <div>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Output:</span>
                          <pre style={{ margin: '2px 0 0 0', fontSize: '10px', color: 'var(--error)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>{tc.actual_output || '(no output)'}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!running && !results && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0', fontFamily: 'JetBrains Mono, monospace' }}>
              Press Run Code to execute your program.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Modal({
  onClose,
  onConfirm,
  questionTitle,
}: {
  onClose: () => void;
  onConfirm: () => void;
  questionTitle: string;
}) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '28px',
          width: '380px',
          maxWidth: '90vw',
        }}
        className="animate-fade-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>
          Submit this answer?
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
          You are submitting your solution for <strong style={{ color: 'var(--text-primary)' }}>{questionTitle}</strong>.
          You will not be able to edit this question after submission.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            id="confirm-submit-btn"
            onClick={onConfirm}
            style={{
              flex: 2,
              padding: '11px',
              background: 'var(--accent)',
              border: '1px solid transparent',
              borderRadius: '3px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function FinalScreen({
  student,
  questions,
  submissions,
  submitScores,
  totalScore,
}: {
  student: { roll_no: string; name: string; division: string };
  questions: Question[];
  submissions: Record<number, Submission>;
  submitScores: Record<number, number>;
  totalScore: number;
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div className="animate-fade-up" style={{ maxWidth: '440px', width: '100%' }}>
        <p style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--success)',
          marginBottom: '12px',
        }}>
          ✓ Test Complete
        </p>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: '4px',
        }}>
          {student.name}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '40px', fontFamily: 'JetBrains Mono, monospace' }}>
          Roll {student.roll_no} · {student.division}
        </p>

        <div style={{ height: '1px', background: 'var(--border)', marginBottom: '32px' }} />

        {/* Per-question scores */}
        {questions.map((q, i) => (
          <div key={q.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
                Q{String(i + 1).padStart(2, '0')}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{q.title}</p>
            </div>
            <span style={{
              fontSize: '18px',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              color: submissions[q.id] ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
              {submitScores[q.id] !== undefined ? `${submitScores[q.id]}` : '—'}<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/10</span>
            </span>
          </div>
        ))}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 0 0',
        }}>
          <div>
            <p className="text-label" style={{ marginBottom: '4px' }}>Total Score</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Submitted at {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span style={{
            fontSize: '36px',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-primary)',
          }}>
            {totalScore}<span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>/30</span>
          </span>
        </div>
      </div>
    </div>
  );
}
