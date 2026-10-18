'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Question {
  id: number;
  title: string;
  topic: string;
  description: string;
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
    allowed_languages?: string[];
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

const STARTER_CODES: Record<string, string> = {
  cpp: `#include <iostream>
using namespace std;

int main() {
    // Write your code here
    
    return 0;
}`,
  c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    // Write your code here
    
    return 0;
}`,
  python: `# Write your code here
def main():
    pass

if __name__ == '__main__':
    main()`,
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        // Write your code here
    }
}`
};

const STARTER_CODE = STARTER_CODES.cpp;

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
  const [language, setLanguage] = useState<string>('cpp');
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
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [showTabSwitchModal, setShowTabSwitchModal] = useState(false);
  const [tabSwitchReason, setTabSwitchReason] = useState('Tab switch or window inactive');
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
  const warningCountRef = useRef(0);
  const internalClipboardRef = useRef<Set<string>>(new Set());
  // Tracks whether Monaco is currently mounting (to suppress spurious onChange)
  const editorMountingRef = useRef(false);

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
        warningCountRef.current = data.session.integrity_warnings;
        
        const allowedLangs = data.session.allowed_languages || ['cpp', 'c', 'python', 'java'];
        const initialLang = allowedLangs.includes('cpp') ? 'cpp' : (allowedLangs[0] || 'cpp');
        setLanguage(initialLang);

        // Initialize codes from saves
        const initialCodes: Record<number, string> = {};
        data.questions.forEach(q => {
          initialCodes[q.id] = data.saves[q.id] || STARTER_CODES[initialLang] || STARTER_CODES.cpp;
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

  // Handle active question change — reset demo state
  useEffect(() => {
    setDemoActive(false);
    setDemoPlaying(false);
    setDemoCode('');
    setDemoIndex(0);
  }, [activeQuestion, sessionData]);

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

  // ── Proctoring: 3 warnings → auto-submit ─────────────────────────────────

  const reportIntegrity = async (event_type: string) => {
    if (!sessionData || loading) return;

    // Increment ref immediately (state update is async)
    warningCountRef.current += 1;
    const newCount = warningCountRef.current;

    // Persist to DB
    try {
      await fetch('/api/exam/integrity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ event_type }),
      });
    } catch {}

    setWarningCount(newCount);

    // Auto-submit on 3rd violation
    if (newCount >= 3) {
      setTabSwitchReason('⚠ 3 violations detected. Your exam has been auto-submitted.');
      setShowTabSwitchModal(true);
      setTimeout(() => handleAutoSubmit(), 2500);
      return;
    }

    if (event_type === 'fullscreen_exit') {
      setShowFullscreenPrompt(true);
    } else {
      setTabSwitchReason(
        event_type === 'external_paste'
          ? '⚠ Pasting from outside the exam is not allowed'
          : event_type === 'screenshot_attempt'
          ? 'A screenshot shortcut was detected'
          : event_type === 'tab_switch'
          ? 'You switched to another tab or window'
          : event_type === 'f11_key'
          ? 'Fullscreen toggle detected'
          : 'Window focus was lost',
      );
      setShowTabSwitchModal(true);
    }
  };

  // Register proctoring event listeners once the session loads
  useEffect(() => {
    if (!sessionData || loading) return;

    // ── 1. Fullscreen ──────────────────────────────────────────────────────
    const enterFullscreen = () => {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    enterFullscreen();

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportIntegrity('fullscreen_exit');
        // Re-enter fullscreen after a short delay so the modal renders first
        setTimeout(enterFullscreen, 400);
      }
    };

    // ── 2. Tab / window switch ─────────────────────────────────────────────
    // Use visibilitychange only — avoid window blur which fires on any
    // in-page interaction (right-click menu, DevTools, iframe focus, etc.)
    let lastHiddenAt = 0;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now();
        if (now - lastHiddenAt < 1500) return; // debounce — same tab re-hidden fast
        lastHiddenAt = now;
        reportIntegrity('tab_switch');
      }
    };

    // ── 3. Screenshot & F11 key combos ────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const { key, code, ctrlKey, metaKey, shiftKey } = e;

      const isPrintScreen = key === 'PrintScreen' || code === 'PrintScreen';
      const isWinSnip     = (metaKey || ctrlKey) && shiftKey && (key === 'S' || key === 's');
      const isMacShot     = metaKey && shiftKey && ['3', '4', '5'].includes(key);
      const isF11         = key === 'F11' || code === 'F11';

      if (isPrintScreen || isWinSnip || isMacShot) {
        e.preventDefault();
        e.stopPropagation();
        reportIntegrity('screenshot_attempt');
        return;
      }

      if (isF11) {
        // Block F11 completely — never let the browser toggle fullscreen via key
        e.preventDefault();
        e.stopPropagation();
        // If we somehow lost fullscreen, record it and re-enter
        if (!document.fullscreenElement) {
          reportIntegrity('f11_key');
          setTimeout(enterFullscreen, 200);
        }
      }
    };

    // ── 4. Copy/cut tracking ───────────────────────────────────────────────
    // Record everything selected+copied from this page so we can allow
    // re-pasting it within the editor (internal clipboard).
    const onCopy = () => {
      const sel = window.getSelection()?.toString() || '';
      if (sel.trim()) {
        internalClipboardRef.current.add(sel.trim());
        if (internalClipboardRef.current.size > 300) {
          const first = internalClipboardRef.current.values().next().value;
          if (first !== undefined) internalClipboardRef.current.delete(first);
        }
      }
    };

    // NOTE: External paste blocking is handled at Monaco level in onMount
    // (not via DOM paste event) because Monaco uses a shadow textarea and
    // the DOM paste event target doesn't reliably identify the editor area.

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('copy', onCopy, { capture: true });
    document.addEventListener('cut', onCopy, { capture: true });

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('copy', onCopy, { capture: true });
      document.removeEventListener('cut', onCopy, { capture: true });
    };
  }, [sessionData, loading]);

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

  const [runTrigger, setRunTrigger] = useState(0);

  const handleRunCode = () => {
    setConsoleOpen(true);
    setRunning(true);
    setRunTrigger(prev => prev + 1);
  };

  const doSubmit = async (questionId: number, code: string): Promise<number> => {
    const res = await fetch('/api/exam/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ question_id: questionId, code, language }),
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
          <p style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', color: 'var(--text-muted)', fontSize: '13px' }}>
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



      {/* Fullscreen Required Modal */}
      {showFullscreenPrompt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'rgba(18, 17, 15, 0.94)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: '#181715',
            border: '1px solid rgba(230, 223, 216, 0.14)',
            borderRadius: '16px',
            padding: '40px 36px 36px',
            boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(204, 120, 92, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Top decorative accent bar in Claude warm gradient */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #cc785c 0%, #e8a55a 50%, #cc785c 100%)'
            }} />

            {/* Pill Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 14px',
              borderRadius: '9999px',
              background: 'rgba(204, 120, 92, 0.14)',
              border: '1px solid rgba(204, 120, 92, 0.35)',
              color: '#cc785c',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              fontFamily: 'StyreneB, Inter, sans-serif'
            }}>
              <span>✦</span> Security & Integrity Lock
            </div>

            {/* Editorial Serif Headline */}
            <h2 style={{
              fontFamily: 'Copernicus, "Tiempos Headline", "Georgia", "Iowan Old Style", serif',
              fontSize: '26px',
              fontWeight: 400,
              color: '#faf9f5',
              marginBottom: '14px',
              lineHeight: 1.25,
              letterSpacing: '-0.4px'
            }}>
              Fullscreen Mode Required
            </h2>

            <p style={{
              fontFamily: 'StyreneB, Inter, sans-serif',
              fontSize: '14px',
              color: '#a09d96',
              lineHeight: 1.6,
              marginBottom: '24px',
              maxWidth: '440px'
            }}>
              Exiting fullscreen is not allowed during the assessment. This violation has been recorded. Further violations will be logged silently.
            </p>

            {/* Warning counter pill */}
            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#252320',
              border: '1px solid rgba(230, 223, 216, 0.10)',
              borderRadius: '8px',
              padding: '12px 18px',
              marginBottom: '28px'
            }}>
              <span style={{
                fontFamily: 'StyreneB, Inter, sans-serif',
                fontSize: '12px',
                color: '#a09d96',
                fontWeight: 500
              }}>
                Recorded Violations
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontSize: '13px',
                color: '#e8a55a',
                fontWeight: 600
              }}>
                {warningCount}
              </span>
            </div>

            <button
              onClick={() => {
                if (document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().then(() => {
                    setShowFullscreenPrompt(false);
                  }).catch(() => {
                    setShowFullscreenPrompt(false);
                  });
                } else {
                  setShowFullscreenPrompt(false);
                }
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: '#cc785c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                letterSpacing: '0',
                cursor: 'pointer',
                fontFamily: 'StyreneB, Inter, sans-serif',
                boxShadow: '0 4px 16px rgba(204, 120, 92, 0.35)',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#a9583e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#cc785c')}
            >
              Return to Fullscreen & Resume Exam
            </button>
          </div>
        </div>
      )}

      {/* Tab Switch / Focus Loss Modal */}
      {showTabSwitchModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999998,
          background: 'rgba(18, 17, 15, 0.94)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: '#181715',
            border: '1px solid rgba(230, 223, 216, 0.14)',
            borderRadius: '16px',
            padding: '40px 36px 36px',
            boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(232, 165, 90, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Top decorative accent bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #e8a55a 0%, #cc785c 100%)'
            }} />

            {/* Pill Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 14px',
              borderRadius: '9999px',
              background: 'rgba(232, 165, 90, 0.14)',
              border: '1px solid rgba(232, 165, 90, 0.35)',
              color: '#e8a55a',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              fontFamily: 'StyreneB, Inter, sans-serif'
            }}>
              <span>✦</span> Assessment Focus Notice
            </div>

            {/* Editorial Serif Headline */}
            <h2 style={{
              fontFamily: 'Copernicus, "Tiempos Headline", "Georgia", "Iowan Old Style", serif',
              fontSize: '26px',
              fontWeight: 400,
              color: '#faf9f5',
              marginBottom: '14px',
              lineHeight: 1.25,
              letterSpacing: '-0.4px'
            }}>
              Window Focus Lost
            </h2>

            <p style={{
              fontFamily: 'StyreneB, Inter, sans-serif',
              fontSize: '14px',
              color: '#a09d96',
              lineHeight: 1.6,
              marginBottom: '24px',
              maxWidth: '440px'
            }}>
              {tabSwitchReason || 'Window focus was lost'}. This violation has been recorded. Further violations will be logged silently.
            </p>

            {/* Violation counter */}
            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#252320',
              border: '1px solid rgba(230, 223, 216, 0.10)',
              borderRadius: '8px',
              padding: '12px 18px',
              marginBottom: '28px'
            }}>
              <span style={{
                fontFamily: 'StyreneB, Inter, sans-serif',
                fontSize: '12px',
                color: '#a09d96',
                fontWeight: 500
              }}>
                Recorded Violations
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontSize: '13px',
                color: '#e8a55a',
                fontWeight: 600
              }}>
                {warningCount}
              </span>
            </div>

            <button
              onClick={() => {
                setShowTabSwitchModal(false);
                if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: '#cc785c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                letterSpacing: '0',
                cursor: 'pointer',
                fontFamily: 'StyreneB, Inter, sans-serif',
                boxShadow: '0 4px 16px rgba(204, 120, 92, 0.35)',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#a9583e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#cc785c')}
            >
              I Understand & Resume Exam
            </button>
          </div>
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
                      fontFamily: 'Söhne Mono, ui-monospace, monospace',
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
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>Q{i + 1}</span>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'Söhne Mono, ui-monospace, monospace',
                  color: submitScores[q.id] !== undefined ? 'var(--success)' : 'var(--text-muted)',
                }}>
                  {submitScores[q.id] !== undefined ? `${submitScores[q.id]}/10` : '—'}
                </span>
              </div>
            ))}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>Total</span>
              <span style={{ fontSize: '11px', fontFamily: 'Söhne Mono, ui-monospace, monospace', color: 'var(--text-secondary)', fontWeight: 600 }}>
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
                  {/* Editor header with actions */}
                  <div style={{
                    height: '48px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                    background: 'var(--surface-1)',
                    flexShrink: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Language:
                      </span>
                      <select
                        value={language}
                        onChange={(e) => {
                          const newLang = e.target.value;
                          setLanguage(newLang);
                          const currCode = codes[currentQuestion.id];
                          const isStarter = !currCode || Object.values(STARTER_CODES).some(t => t.trim() === currCode.trim());
                          if (isStarter && STARTER_CODES[newLang]) {
                            setCodes(prev => ({ ...prev, [currentQuestion.id]: STARTER_CODES[newLang] }));
                          }
                        }}
                        disabled={isSubmitted}
                        style={{
                          background: 'var(--surface-2)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          outline: 'none',
                          cursor: isSubmitted ? 'not-allowed' : 'pointer',
                          fontFamily: 'Söhne Mono, ui-monospace, monospace',
                        }}
                      >
                        {(sessionData.session.allowed_languages || ['cpp', 'c', 'python', 'java']).map(l => (
                          <option key={l} value={l}>
                            {l === 'cpp' ? 'C++' : l === 'c' ? 'C' : l === 'python' ? 'Python' : 'Java'}
                          </option>
                        ))}
                      </select>
                      
                      {!isSubmitted && (
                        <button
                          onClick={() => setCodes(prev => ({ ...prev, [currentQuestion.id]: STARTER_CODES[language] || STARTER_CODES.cpp }))}
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
                          Reset Code
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {isSubmitted ? (
                        <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600, letterSpacing: '0.08em' }}>
                          ✓ SUBMITTED · {submitScores[currentQuestion.id] ?? 0}/10
                        </span>
                      ) : demoActive ? (
                        <>
                          <div style={{ padding: '4px 8px', background: 'var(--accent)', color: 'white', fontSize: '10px', fontWeight: 700, borderRadius: '2px', letterSpacing: '0.05em' }}>
                            DEMO MODE
                          </div>
                          <button onClick={() => setDemoActive(false)} style={{...demoBtnStyle, border: '1px solid var(--error)', color: 'var(--error)'}}>
                            Exit Demo
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            id="run-code-btn"
                            onClick={handleRunCode}
                            disabled={submitting}
                            title={running ? 'Click to restart execution' : 'Compile & run in terminal'}
                            style={{
                              padding: '6px 16px',
                              background: running ? 'rgba(56, 189, 248, 0.15)' : 'var(--surface-2)',
                              border: running ? '1px solid #38bdf8' : '1px solid var(--border)',
                              borderRadius: '4px',
                              color: running ? '#38bdf8' : 'var(--text-primary)',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: submitting ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {running ? 'Running...' : 'Run Code'}
                          </button>

                          <button
                            id="submit-btn"
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={submitting}
                            style={{
                              padding: '6px 16px',
                              background: submitting ? 'var(--surface-2)' : '#ffffff',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              color: submitting ? 'var(--text-muted)' : '#000000',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: submitting ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {submitting ? 'Submitting...' : 'Submit'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Monaco Editor — key=questionId forces full remount on question switch,
                      preventing code from bleeding across questions */}
                  <div
                    data-editor="true"
                    style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
                  >
                    <MonacoEditor
                      key={`editor-${currentQuestion.id}`}
                      height="100%"
                      language={language === 'c' ? 'c' : language === 'cpp' ? 'cpp' : language === 'python' ? 'python' : 'java'}
                      theme="light"
                      value={demoActive ? demoCode : (codes[currentQuestion.id] || STARTER_CODE)}
                      onChange={(val) => {
                        if (isSubmitted) return;
                        // Suppress the initial onChange emitted during mount/remount —
                        // this is what caused the code to reset when switching questions.
                        if (editorMountingRef.current) return;
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
                        if (demoActive) { setDemoCode(val || ''); return; }
                        setCodes(prev => ({ ...prev, [currentQuestion.id]: val || '' }));
                      }}
                      options={{
                        readOnly: isSubmitted,
                        fontSize: 13,
                        fontFamily: 'Söhne Mono, ui-monospace, monospace',
                        fontLigatures: true,
                        lineNumbers: 'on',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: 'on',
                        padding: { top: 16, bottom: 16 },
                        contextmenu: true,
                        dragAndDrop: false,
                        copyWithSyntaxHighlighting: true,
                      }}
                      onMount={(editor, monaco) => {
                        // Suppress the spurious onChange that Monaco fires on first mount.
                        // Without this, switching questions causes the new question's code
                        // to be overwritten by the initial value emitted during remount.
                        editorMountingRef.current = true;
                        setTimeout(() => { editorMountingRef.current = false; }, 150);

                        // Ctrl+Enter → Run Code
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                          if (!isSubmitted) handleRunCode();
                        });

                        // Track Ctrl+C / Ctrl+X — record copied text as "internal"
                        editor.onKeyDown((ke) => {
                          const isCopy = (ke.ctrlKey || ke.metaKey) && ke.keyCode === monaco.KeyCode.KeyC;
                          const isCut  = (ke.ctrlKey || ke.metaKey) && ke.keyCode === monaco.KeyCode.KeyX;
                          if (isCopy || isCut) {
                            const sel = editor.getSelection();
                            if (sel) {
                              const text = editor.getModel()?.getValueInRange(sel) || '';
                              if (text.trim()) internalClipboardRef.current.add(text.trim());
                            }
                          }

                          // Intercept Ctrl+V / Cmd+V — block external paste
                          const isPaste = (ke.ctrlKey || ke.metaKey) && ke.keyCode === monaco.KeyCode.KeyV;
                          if (isPaste && !isSubmitted) {
                            // Read clipboard via async API, then decide.
                            // We suppress the default paste here and re-apply only if internal.
                            ke.preventDefault();
                            ke.stopPropagation();

                            navigator.clipboard.readText().then(text => {
                              if (!text.trim()) return;

                              const isInternal = [...internalClipboardRef.current].some(
                                saved => text.includes(saved) || saved.includes(text)
                              );

                              if (isInternal) {
                                // Allowed — insert at cursor position
                                editor.trigger('keyboard', 'type', { text });
                              } else {
                                // External paste — warn and block
                                reportIntegrity('external_paste');
                              }
                            }).catch(() => {
                              // Clipboard API denied — block silently (can't verify)
                              reportIntegrity('external_paste');
                            });
                          }
                        });
                      }}
                    />
                  </div>

                  {/* Console Panel (Bottom Split) */}
                  <ConsolePanel
                    open={consoleOpen}
                    onToggle={() => setConsoleOpen(p => !p)}
                    running={running}
                    setRunning={setRunning}
                    runTrigger={runTrigger}
                    code={codes[currentQuestion?.id || 0] || STARTER_CODE}
                    language={language}
                    getToken={getToken}
                    questionId={currentQuestion?.id}
                    onRunCode={handleRunCode}
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
        fontFamily: 'Söhne Mono, ui-monospace, monospace',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        letterSpacing: '0.04em',
      }}>CODE//ZEAL</span>

      <div style={{ height: '16px', width: '1px', background: 'var(--border)' }} />

      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>S.Y. B.Tech AI&DS</span>

      <div style={{ height: '16px', width: '1px', background: 'var(--border)' }} />

      <span style={{
        fontSize: '12px',
        color: 'var(--text-secondary)',
        fontFamily: 'Söhne Mono, ui-monospace, monospace',
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
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
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
        fontFamily: 'Söhne Mono, ui-monospace, monospace',
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
      <div style={{ marginBottom: '28px' }}>
        <p style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: '6px',
          fontFamily: 'Söhne Mono, ui-monospace, monospace',
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

      <Section label="Problem">
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {question.description || question.statement}
        </p>
      </Section>

      {question.input_format && (
        <Section label="Input Format">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {question.input_format}
          </p>
        </Section>
      )}

      {question.output_format && (
        <Section label="Output Format">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {question.output_format}
          </p>
        </Section>
      )}

      {question.constraints && (
        <Section label="Constraints">
          <p style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {question.constraints}
          </p>
        </Section>
      )}

      {question.example_input && (
        <Section label="Sample Input">
          <pre style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px', fontFamily: 'Söhne Mono, monospace', color: 'var(--text-primary)', overflowX: 'auto', margin: 0 }}>
            {question.example_input}
          </pre>
        </Section>
      )}

      {question.example_output && (
        <Section label="Sample Output">
          <pre style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px', fontFamily: 'Söhne Mono, monospace', color: 'var(--text-primary)', overflowX: 'auto', margin: 0 }}>
            {question.example_output}
          </pre>
        </Section>
      )}

      <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '3px', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          💡 <strong style={{ color: 'var(--text-secondary)' }}>Note:</strong> You can use a hardcoded array or take input from the user.
        </p>
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
  running,
  setRunning,
  runTrigger,
  code,
  language,
  getToken,
  questionId,
  input,
  setInput,
  exampleInput,
  onRunCode,
}: {
  open: boolean;
  onToggle: () => void;
  running: boolean;
  setRunning: (val: boolean) => void;
  runTrigger: number;
  code: string;
  language: string;
  getToken?: () => string;
  questionId?: number;
  input?: string;
  setInput?: (val: string | ((prev: string) => string)) => void;
  exampleInput?: string;
  onRunCode?: () => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const onDataDisposableRef = useRef<any>(null);

  // ── Build the xterm instance once ──────────────────────────────────────────
  const ensureTerminal = async () => {
    if (xtermRef.current) return xtermRef.current;
    const el = terminalRef.current;
    if (!el) return null;

    const { Terminal } = await import('xterm');
    const { FitAddon } = await import('xterm-addon-fit');
    await import('xterm/css/xterm.css');

    if (xtermRef.current) return xtermRef.current; // double-check after async gap

    const term = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, 'Menlo', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(el);
    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const ro = new ResizeObserver(() => {
      try { fitAddonRef.current?.fit(); } catch {}
    });
    ro.observe(el);

    // Welcome banner
    term.writeln('\x1b[38;5;240m─────────────────────────────────────────────────────────────\x1b[0m');
    term.writeln('  \x1b[1;32mCODE//ZEAL\x1b[0m \x1b[38;5;240mInteractive Terminal  ·  Run Code or press Ctrl+Enter\x1b[0m');
    term.writeln('\x1b[38;5;240m─────────────────────────────────────────────────────────────\x1b[0m\r\n');

    return term;
  };

  // Keep terminal fitted when panel opens
  useEffect(() => {
    ensureTerminal().then(() => {
      if (open && fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 60);
      }
    });
  }, [open]);

  // ── HTTP fallback execution (production / Vercel) ───────────────────────────
  // Uses a two-phase approach:
  //   Phase 1: if the program reads from stdin, let the user type their input first.
  //   Phase 2: send everything to /api/exam/run with the captured stdin.
  const stdinBufferRef = useRef<string>('');
  const [awaitingStdin, setAwaitingStdin] = useState(false);
  const awaitingStdinRef = useRef(false);  // mirror for use inside callbacks

  const runViaHttp = async (termInstance: any, stdinInput: string) => {
    const term = termInstance;
    const displayLang = (language || 'cpp').toUpperCase();

    term.writeln(`\x1b[1;33m▶ Compiling & running (${displayLang})...\x1b[0m\r\n`);

    try {
      const token = getToken ? getToken() : '';
      const res = await fetch('/api/exam/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code, language, question_id: questionId, input: stdinInput }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        term.writeln(`\x1b[1;31m✖ Engine Error: ${data.error || res.statusText || 'Execution failed'}\x1b[0m\r\n`);
      } else if (!data.success && data.compile_error) {
        term.writeln(`\x1b[1;31m✖ Compilation Error\x1b[0m\r\n`);
        term.write(`\x1b[31m${data.compile_error.replace(/\r?\n/g, '\r\n')}\x1b[0m\r\n`);
      } else if (data.timed_out) {
        term.writeln(`\x1b[1;31m✖ Time Limit Exceeded\x1b[0m\r\n`);
      } else {
        // Write program output — normalize newlines for xterm
        // Also inject \r\n after colon-terminated lines (cin prompts) so
        // programs that use cout without endl still display line-by-line
        let out = (data.output || '').replace(/\r?\n/g, '\r\n');
        // Insert \r\n after every "prompt" segment ending with ':' or ': '
        // that is immediately followed by more text (no newline between them)
        out = out.replace(/(:[  ]?)(?=[^\r\n])/g, '$1\r\n');
        term.write(out);
        // Ensure we end on a fresh line
        if (out && !out.endsWith('\r\n')) term.write('\r\n');
        if (data.stderr) {
          term.write(`\x1b[31m${data.stderr.replace(/\r?\n/g, '\r\n')}\x1b[0m\r\n`);
        }
      }
      term.writeln(`\r\n\x1b[38;5;240m[Exited · ${data.execution_time || 0}ms]\x1b[0m\r\n`);
    } catch (err: any) {
      term.writeln(`\x1b[1;31m✖ Engine Error: ${err.message || 'Unknown'}\x1b[0m\r\n`);
    } finally {
      setRunning(false);
      setAwaitingStdin(false);
      awaitingStdinRef.current = false;
      stdinBufferRef.current = '';
    }
  };

  const triggerExecuteWithStdin = () => {
    if (onDataDisposableRef.current) {
      try { onDataDisposableRef.current.dispose(); } catch {}
      onDataDisposableRef.current = null;
    }
    setAwaitingStdin(false);
    awaitingStdinRef.current = false;
    const term = xtermRef.current;
    if (term) {
      term.writeln('\r\n\x1b[38;5;240m─────────────────────────────────────────────────────────────\x1b[0m');
      runViaHttp(term, stdinBufferRef.current);
    } else {
      setRunning(false);
    }
  };

  const setupStdinCollection = (term: any) => {
    setAwaitingStdin(true);
    awaitingStdinRef.current = true;
    stdinBufferRef.current = '';

    term.writeln('\x1b[38;5;240m─────────────────────────────────────────────────────────────\x1b[0m');
    term.writeln('  \x1b[1;33mSTDIN INPUT\x1b[0m \x1b[38;5;240m— Program requires input. Type below and press \x1b[0m\x1b[1;32mEnter\x1b[0m\x1b[38;5;240m.\x1b[0m');
    term.writeln('  \x1b[38;5;240mWhen ready, click \x1b[0m\x1b[1;32m[▶ Execute with Input]\x1b[0m\x1b[38;5;240m or press \x1b[0m\x1b[1;32mCtrl+Enter\x1b[0m\x1b[38;5;240m.\x1b[0m');
    term.writeln('\x1b[38;5;240m─────────────────────────────────────────────────────────────\x1b[0m\r\n');

    let lineBuffer = '';

    if (onDataDisposableRef.current) {
      try { onDataDisposableRef.current.dispose(); } catch {}
      onDataDisposableRef.current = null;
    }

    onDataDisposableRef.current = term.onData((data: string) => {
      if (!awaitingStdinRef.current) return;

      if (data === '\x04') {
        if (lineBuffer.trim()) {
          stdinBufferRef.current += lineBuffer + '\n';
          lineBuffer = '';
        }
        triggerExecuteWithStdin();
        return;
      }
      if (data === '\r' || data === '\n') {
        term.write('\r\n');
        stdinBufferRef.current += lineBuffer + '\n';
        lineBuffer = '';
        return;
      }
      if (data === '\u007F' || data === '\b') {
        if (lineBuffer.length > 0) {
          lineBuffer = lineBuffer.slice(0, -1);
          term.write('\b \b');
        }
        return;
      }
      if (data >= ' ' || data === '\t') {
        lineBuffer += data;
        term.write(data);
      }
    });
  };

  // ── Main run effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (runTrigger === 0 || !code) return;

    // If Run Code is clicked again while awaiting stdin, flush and execute!
    if (awaitingStdinRef.current && xtermRef.current) {
      triggerExecuteWithStdin();
      return;
    }

    // Tear down any existing socket/listeners
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch {}
      socketRef.current = null;
    }
    if (onDataDisposableRef.current) {
      try { onDataDisposableRef.current.dispose(); } catch {}
      onDataDisposableRef.current = null;
    }

    // Reset awaiting-stdin state
    setAwaitingStdin(false);
    awaitingStdinRef.current = false;
    stdinBufferRef.current = '';

    let cancelled = false;

    (async () => {
      const term = await ensureTerminal();
      if (!term) { setRunning(false); return; }
      if (cancelled) return;

      term.clear();
      setTimeout(() => fitAddonRef.current?.fit(), 30);
      term.focus();

      const isLocal =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '0.0.0.0');

      // ── PTY path (local dev) ──────────────────────────────────────────────
      if (isLocal) {
        let connected = false;
        let fell = false;

        const fallback = () => {
          if (!fell) {
            fell = true;
            try { socketRef.current?.disconnect(); } catch {}
            if (!cancelled) {
              const needsStdin = /\bcin\b|\bscanf\b|\bgets\b|\binput\s*\(|\bgetline\b|\bread\s*\(/.test(code);
              if (!needsStdin) {
                runViaHttp(term, '');
              } else {
                setupStdinCollection(term);
              }
            }
          }
        };

        let socketModule: any;
        try {
          socketModule = await import('socket.io-client');
        } catch {
          fallback();
          return;
        }
        if (cancelled) return;

        const host = window.location.hostname || 'localhost';
        const sessionToken =
          (typeof window !== 'undefined' ? localStorage.getItem('session_token') : null) || '';
        const ioFunc = socketModule.io || socketModule.default || socketModule;
        const socket = ioFunc(`http://${host}:4000`, {
          timeout: 2500,
          reconnection: false,
          auth: { token: sessionToken },
        });
        socketRef.current = socket;

        const connTimer = setTimeout(() => {
          if (!connected) fallback();
        }, 2000);

        socket.on('connect_error', () => {
          clearTimeout(connTimer);
          fallback();
        });

        socket.on('connect', () => {
          if (cancelled) { try { socket.disconnect(); } catch {} return; }
          connected = true;
          clearTimeout(connTimer);
          socket.emit('execute', { code, language, timeLimit: 120000 });
        });

        socket.on('output', (chunk: string) => {
          if (!cancelled) term.write(chunk);
        });

        socket.on('finished', () => {
          if (!cancelled) {
            setRunning(false);
            try { socket.disconnect(); } catch {}
          }
        });

        onDataDisposableRef.current = term.onData((data: string) => {
          if (socket.connected) socket.emit('input', data);
        });

        // Safety timeout (130s)
        setTimeout(() => { if (!cancelled) setRunning(false); }, 130000);
        return;
      }

      // ── HTTP path (production) ────────────────────────────────────────────
      const needsStdin =
        /\bcin\b|\bscanf\b|\bgets\b|\binput\s*\(|\bgetline\b|\bread\s*\(/.test(code);

      if (!needsStdin) {
        runViaHttp(term, '');
      } else {
        setupStdinCollection(term);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runTrigger]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    xtermRef.current?.clear();
  };

  const handleKill = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch {}
      socketRef.current = null;
    }
    if (onDataDisposableRef.current) {
      try { onDataDisposableRef.current.dispose(); } catch {}
      onDataDisposableRef.current = null;
    }
    setAwaitingStdin(false);
    awaitingStdinRef.current = false;
    setRunning(false);
    xtermRef.current?.writeln('\r\n\x1b[31m[Process terminated]\x1b[0m\r\n');
  };

  return (
    <div style={{
      height: open ? '320px' : '36px',
      borderTop: '1px solid #21262d',
      background: '#0d1117',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      transition: 'height 0.18s ease',
    }}>
      {/* Title bar */}
      <div
        onClick={onToggle}
        style={{
          height: '36px',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: '#161b22',
          borderBottom: open ? '1px solid #21262d' : 'none',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* VS Code-style terminal tab */}
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#58a6ff',
            fontFamily: 'Söhne Mono, monospace',
            letterSpacing: '0.04em',
            background: '#1c2128',
            border: '1px solid #30363d',
            padding: '2px 10px',
            borderRadius: '3px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}>
            <span style={{ fontSize: '9px' }}>▶</span> TERMINAL
          </span>

          {running && !awaitingStdin && (
            <span style={{
              fontSize: '10px',
              fontFamily: 'Söhne Mono, monospace',
              color: '#3fb950',
              background: 'rgba(63, 185, 80, 0.1)',
              padding: '2px 8px',
              borderRadius: '3px',
              border: '1px solid rgba(63, 185, 80, 0.3)',
              animation: 'none',
            }}>
              ● Running
            </span>
          )}

          {awaitingStdin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerExecuteWithStdin();
              }}
              style={{
                fontSize: '11px',
                fontFamily: 'Söhne Mono, monospace',
                color: '#ffffff',
                background: '#238636',
                padding: '2px 10px',
                borderRadius: '3px',
                border: '1px solid #2ea043',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>▶</span> Execute with Input
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
          {open && (
            <>
              <button
                onClick={handleClear}
                style={{
                  padding: '2px 8px',
                  background: 'transparent',
                  border: '1px solid #30363d',
                  borderRadius: '3px',
                  color: '#8b949e',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Söhne Mono, monospace',
                }}
              >
                Clear
              </button>
              {(running || awaitingStdin) && (
                <button
                  onClick={handleKill}
                  style={{
                    padding: '2px 8px',
                    background: 'rgba(255, 123, 114, 0.1)',
                    border: '1px solid rgba(255, 123, 114, 0.4)',
                    borderRadius: '3px',
                    color: '#ff7b72',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Söhne Mono, monospace',
                  }}
                >
                  Kill
                </button>
              )}
            </>
          )}
          <span style={{ fontSize: '11px', color: '#6e7681' }}>
            {open ? '▾' : '▴'}
          </span>
        </div>
      </div>

      {/* xterm container — always mounted so the terminal instance survives */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          padding: '6px 8px',
          background: '#0d1117',
          overflow: 'hidden',
          display: open ? 'block' : 'none',
        }}
      />
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999990,
        background: 'rgba(18, 17, 15, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        className="animate-fade-up"
        style={{
          maxWidth: '440px',
          width: '100%',
          background: '#181715',
          border: '1px solid rgba(230, 223, 216, 0.14)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(204, 120, 92, 0.15)',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #cc785c 0%, #e8a55a 100%)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '9999px',
              background: 'rgba(204, 120, 92, 0.12)',
              border: '1px solid rgba(204, 120, 92, 0.3)',
              color: '#cc785c',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '10px',
              fontFamily: 'StyreneB, Inter, sans-serif'
            }}>
              <span>✦</span> Submission Confirm
            </div>
            <h3 style={{
              fontFamily: 'Copernicus, "Tiempos Headline", "Georgia", "Iowan Old Style", serif',
              fontSize: '22px',
              fontWeight: 400,
              color: '#faf9f5',
              letterSpacing: '-0.3px',
              margin: 0
            }}>
              Submit Solution?
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#a09d96',
              fontSize: '22px',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '4px',
              transition: 'color 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#faf9f5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#a09d96')}
          >
            ×
          </button>
        </div>

        <p style={{
          fontFamily: 'StyreneB, Inter, sans-serif',
          fontSize: '14px',
          color: '#a09d96',
          lineHeight: 1.6,
          marginBottom: '28px'
        }}>
          You are about to finalize and submit your solution for <strong style={{ color: '#faf9f5', fontWeight: 600 }}>{questionTitle}</strong>. Once submitted, your code is recorded and cannot be edited.
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px 16px',
              background: '#252320',
              border: '1px solid rgba(230, 223, 216, 0.12)',
              borderRadius: '8px',
              color: '#faf9f5',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'StyreneB, Inter, sans-serif',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2e2b27')}
            onMouseLeave={e => (e.currentTarget.style.background = '#252320')}
          >
            Cancel
          </button>
          <button
            id="confirm-submit-btn"
            onClick={onConfirm}
            style={{
              flex: 1.5,
              padding: '11px 16px',
              background: '#cc785c',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'StyreneB, Inter, sans-serif',
              boxShadow: '0 4px 14px rgba(204, 120, 92, 0.35)',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#a9583e')}
            onMouseLeave={e => (e.currentTarget.style.background = '#cc785c')}
          >
            Confirm Submission
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
        <div style={{ marginBottom: '12px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#4e9a6e',
            background: 'rgba(78, 154, 110, 0.12)',
            border: '1px solid rgba(78, 154, 110, 0.3)',
            padding: '4px 12px',
            borderRadius: '999px',
          }}>
            ✓ Submitted Successfully
          </span>
        </div>

        <h1 style={{
          fontSize: '34px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          marginBottom: '6px',
          fontFamily: 'Copernicus, "Times New Roman", Georgia, serif',
        }}>
          {student.name}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>
          Roll {student.roll_no} · Division {student.division}
        </p>

        {/* Official Announcement Notice */}
        <div style={{
          padding: '20px 22px',
          background: 'var(--surface-1, #181715)',
          border: '1px solid var(--accent, #cc785c)',
          borderRadius: '8px',
          marginBottom: '32px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--accent, #cc785c)', fontSize: '15px' }}>✦</span>
            <h2 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
              fontFamily: 'Copernicus, Georgia, serif',
            }}>
              Results Will Be Out Soon
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Your exam responses and code drafts have been securely saved and submitted. 
            The official results and evaluation marksheet PDF will be published and shared directly in your <strong>College WhatsApp Group</strong> once faculty verification is completed.
          </p>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <p className="text-label" style={{ margin: 0 }}>
            Questions Summary
          </p>
          <span style={{
            fontSize: '12px',
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            color: 'var(--text-muted)',
          }}>
            {Object.keys(submissions).length} / {questions.length} Attempted
          </span>
        </div>

        <div style={{ marginBottom: '28px', borderTop: '1px solid var(--border)' }}>
          {questions.map((q, i) => {
            const hasSubmission = Boolean(submissions[q.id]);
            return (
              <div key={q.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>
                    Question {String(i + 1).padStart(2, '0')}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>{q.title}</p>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: hasSubmission ? 'rgba(78, 154, 110, 0.12)' : 'rgba(150, 150, 150, 0.08)',
                  color: hasSubmission ? '#4e9a6e' : 'var(--text-muted)',
                  border: `1px solid ${hasSubmission ? 'rgba(78, 154, 110, 0.3)' : 'var(--border)'}`,
                }}>
                  {hasSubmission ? '✓ Submitted' : '— Not Attempted'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Submission Timestamp & Exit Guidance */}
        <div style={{
          padding: '16px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Submission Recorded
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, margin: '2px 0 0', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>
              {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              ✓ Safe to close this tab
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
