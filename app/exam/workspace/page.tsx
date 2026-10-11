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
  const [customInput, setCustomInput] = useState('');
  
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

  const lastWarningRef = useRef<number>(0);
  const lastEventTypeRef = useRef<string>('');

  // Integrity monitoring
  useEffect(() => {
    if (!sessionData) return;

    // Try to enter fullscreen on mount
    const requestFullscreen = () => {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    
    // Listen for interaction to trigger fullscreen
    const firstClick = () => {
      requestFullscreen();
      document.removeEventListener('click', firstClick);
    };
    document.addEventListener('click', firstClick);

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setShowFullscreenPrompt(true);
        reportIntegrity('fullscreen_exit');
      } else {
        setShowFullscreenPrompt(false);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        setTabSwitchReason('You navigated away from the exam tab (Tab Switch / Minimized)');
        setShowTabSwitchModal(true);
        reportIntegrity('tab_hidden');
      }
    };

    const handleBlur = () => {
      setTabSwitchReason('Exam window lost focus (Application Switch / Window Inactive)');
      setShowTabSwitchModal(true);
      reportIntegrity('window_blur');
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      reportIntegrity('right_click');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const key = e.key;
      const code = e.code || '';
      const lowerKey = key.toLowerCase();

      // 1. Strictly block F11
      if (key === 'F11' || code === 'F11' || e.keyCode === 122) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setShowFullscreenPrompt(true);
        reportIntegrity('fullscreen_exit');
        return false;
      }

      // 2. Block all Function Keys F1 - F12
      if (/^F([1-9]|1[0-2])$/.test(key) || /^F([1-9]|1[0-2])$/.test(code)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reportIntegrity('forbidden_key');
        return false;
      }

      // 3. Block Windows Start Key / Meta Key / Command Key
      if (e.metaKey || key === 'Meta' || key === 'OS' || code === 'MetaLeft' || code === 'MetaRight') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reportIntegrity('forbidden_key');
        return false;
      }

      // 4. Block Escape key
      if (key === 'Escape' || code === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reportIntegrity('forbidden_key');
        return false;
      }

      // 5. Block PrintScreen / Screen Capture
      if (key === 'PrintScreen' || code === 'PrintScreen' || e.keyCode === 44 || (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(key))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
        reportIntegrity('forbidden_key');
        return false;
      }

      // 6. Block ContextMenu key
      if (key === 'ContextMenu' || code === 'ContextMenu') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reportIntegrity('right_click');
        return false;
      }

      // 7. Block Alt combinations (Alt+Tab, Alt+F4, Alt+Left/Right)
      if (e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reportIntegrity('forbidden_key');
        return false;
      }

      // 8. Block Ctrl/Cmd combinations: C, V, X, A, U, S, P, I, J
      if (e.ctrlKey || (isMac && e.metaKey)) {
        if (['c', 'v', 'x', 'a', 'u', 's', 'p', 'i', 'j'].includes(lowerKey)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (['c', 'v', 'x'].includes(lowerKey)) {
            reportIntegrity('copy_paste_attempt');
          } else {
            reportIntegrity('forbidden_key');
          }
          return false;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
        reportIntegrity('forbidden_key');
      }
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      reportIntegrity('copy_paste_attempt');
    };

    const handlePreventSelection = (e: Event) => {
      e.preventDefault();
    };

    // Use capture phase (true) so listeners trigger BEFORE Monaco/Terminal or child inputs
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('copy', handleCopyPaste, true);
    window.addEventListener('paste', handleCopyPaste, true);
    window.addEventListener('cut', handleCopyPaste, true);
    document.addEventListener('selectstart', handlePreventSelection, true);
    document.addEventListener('dragstart', handlePreventSelection, true);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('click', firstClick);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('copy', handleCopyPaste, true);
      window.removeEventListener('paste', handleCopyPaste, true);
      window.removeEventListener('cut', handleCopyPaste, true);
      document.removeEventListener('selectstart', handlePreventSelection, true);
      document.removeEventListener('dragstart', handlePreventSelection, true);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionData]);

  const reportIntegrity = async (event_type: string) => {
    const now = Date.now();
    // Allow distinct event types immediately; throttle identical repeats within 1.5s
    if (lastEventTypeRef.current === event_type && (now - lastWarningRef.current < 1500)) {
      return;
    }
    lastWarningRef.current = now;
    lastEventTypeRef.current = event_type;

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
      
      const eventMap: Record<string, string> = {
        'tab_hidden': 'Leaving the exam tab',
        'window_blur': 'Switching away from the exam window',
        'fullscreen_exit': 'Exiting fullscreen mode',
        'right_click': 'Right-clicking',
        'forbidden_key': 'Using forbidden keyboard shortcuts',
        'copy_paste_attempt': 'Copying or pasting'
      };
      
      if (data.warnings >= 3) {
        setIntegrityWarning('Maximum warnings exceeded (3/3). Your exam is being automatically submitted.');
        handleAutoSubmit();
      } else {
        setIntegrityWarning(`${eventMap[event_type] || 'A forbidden action'} has been detected. Warning ${data.warnings} of 3.`);
      }
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

      {/* Integrity Warning */}
      {integrityWarning && (
        <div style={{
          background: '#252320',
          borderBottom: '1px solid rgba(204, 120, 92, 0.3)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '9999px',
              background: 'rgba(204, 120, 92, 0.15)',
              border: '1px solid rgba(204, 120, 92, 0.35)',
              color: '#cc785c',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontFamily: 'StyreneB, Inter, sans-serif'
            }}>
              <span>✦</span> Integrity Notice
            </span>
            <span style={{ fontSize: '13px', color: '#faf9f5', fontFamily: 'StyreneB, Inter, sans-serif' }}>
              {integrityWarning}
            </span>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: '#181715',
            border: '1px solid rgba(230, 223, 216, 0.12)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '12px',
            color: '#e8a55a',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e8a55a' }} />
            Warnings: <strong style={{ color: '#faf9f5' }}>{warningCount}</strong> / 3
          </div>
        </div>
      )}

      {/* Fullscreen Required Modal Overlay */}
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
              Leaving fullscreen or switching windows is prohibited. This incident has been logged to your proctoring audit log.
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
                {warningCount} of 3 Allowed
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
      {showTabSwitchModal && !showFullscreenPrompt && (
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
              {tabSwitchReason || 'Window focus was lost'}. Navigating away from the active assessment window is strictly monitored.
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
                {warningCount} of 3 Allowed
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
                            disabled={submitting || running}
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
                      language={language === 'c' ? 'c' : language === 'cpp' ? 'cpp' : language === 'python' ? 'python' : 'java'}
                      theme="light"
                      value={demoActive ? demoCode : (codes[currentQuestion.id] || STARTER_CODE)}
                      onChange={(val) => {
                        if (isSubmitted) return;
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
                        contextmenu: false,
                        dragAndDrop: false,
                        copyWithSyntaxHighlighting: false,
                      }}
                      onMount={(editor, monaco) => {
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                          if (!isSubmitted) handleRunCode();
                        });
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
                          reportIntegrity('copy_paste_attempt');
                        });
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
                          reportIntegrity('copy_paste_attempt');
                        });
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
                          reportIntegrity('copy_paste_attempt');
                        });
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA, () => {
                          reportIntegrity('forbidden_key');
                        });
                        editor.addCommand(monaco.KeyCode.F11, () => {
                          setShowFullscreenPrompt(true);
                          reportIntegrity('fullscreen_exit');
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
                    input={customInput}
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
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const onDataDisposableRef = useRef<any>(null);

  const ensureTerminal = async () => {
    if (xtermRef.current) return xtermRef.current;
    const el = terminalRef.current;
    if (!el) return null;
    const { Terminal } = await import('xterm');
    const { FitAddon } = await import('xterm-addon-fit');
    await import('xterm/css/xterm.css');
    
    if (xtermRef.current) return xtermRef.current;

    const term = new Terminal({
      theme: {
        background: '#090a0f',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: '#1e293b',
        black: '#090a0f',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#38bdf8',
        brightWhite: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(el);
    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    window.addEventListener('resize', () => {
      try { fitAddonRef.current?.fit(); } catch {}
    });

    term.writeln('\x1b[1;36m═══════════════════════════════════════════════════════════════\x1b[0m');
    term.writeln('\x1b[1;32m  DSA Interactive Terminal\x1b[0m \x1b[90m(Stdin / Terminal Mode Active)\x1b[0m');
    term.writeln('\x1b[90m  Press "Run Code" above or Ctrl+Enter to compile & run.\x1b[0m');
    term.writeln('\x1b[1;36m═══════════════════════════════════════════════════════════════\x1b[0m\r\n');

    return term;
  };

  useEffect(() => {
    ensureTerminal().then(() => {
      if (open && fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 60);
      }
    });
  }, [open]);

  const runViaHttpFallback = async (termInstance?: any) => {
    const term = termInstance || xtermRef.current;
    if (!term) {
      setRunning(false);
      return;
    }
    const displayLang = (language || 'cpp').toUpperCase();
    term.writeln(`\x1b[1;33m● Compiling source via Execution Engine (${displayLang})...\x1b[0m\r\n`);
    
    try {
      const token = getToken ? getToken() : '';
      const res = await fetch('/api/exam/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ code, language, question_id: questionId, input: input || '' })
      });
      const data = await res.json();
      
      if (!data.success && data.compile_error) {
        term.writeln(`\r\n\x1b[1;31m✖ Compilation Error:\x1b[0m\r\n\x1b[31m${data.compile_error.replace(/\n/g, '\r\n')}\x1b[0m\r\n`);
      } else if (data.timed_out) {
        term.writeln(`\r\n\x1b[1;31m✖ Time Limit Exceeded (5s)\x1b[0m\r\n`);
      } else {
        term.writeln(`\x1b[1;32m✔ Build successful\x1b[0m\r\n\x1b[1;36m$\x1b[0m \x1b[90m./a.out\x1b[0m\r\n`);
        if (data.output) {
          term.write(data.output.replace(/\n/g, '\r\n'));
        }
        if (data.stderr) {
          term.write(`\r\n\x1b[31m${data.stderr.replace(/\n/g, '\r\n')}\x1b[0m`);
        }
        term.writeln(`\r\n\x1b[90m----------------------------------------\r\n[Process completed in ${data.execution_time || 0}ms]\x1b[0m\r\n`);
      }
    } catch (err: any) {
      term.writeln(`\r\n\x1b[1;31m✖ Execution Engine Error: ${err.message || 'Unknown'}\x1b[0m\r\n`);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (runTrigger === 0 || !code) return;

    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch {}
      socketRef.current = null;
    }
    if (onDataDisposableRef.current) {
      try { onDataDisposableRef.current.dispose(); } catch {}
      onDataDisposableRef.current = null;
    }

    let isCancelled = false;

    (async () => {
      try {
        const term = await ensureTerminal();
        if (!term || isCancelled) {
          setRunning(false);
          return;
        }

        term.clear();
        setTimeout(() => fitAddonRef.current?.fit(), 30);
        term.focus();

        const isLocal = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0');

        // On deployed production, immediately use HTTP Execution Engine (no 4000 port delay or mixed content)
        if (!isLocal) {
          runViaHttpFallback(term);
          return;
        }

        let connected = false;
        let fallbackTriggered = false;

        const { io } = await import('socket.io-client');
        const host = window.location.hostname || 'localhost';
        const sessionToken = (typeof window !== 'undefined' ? localStorage.getItem('session_token') : null) || '';
        const socket = io(`http://${host}:4000`, {
          timeout: 2500,
          reconnection: false,
          auth: {
            token: sessionToken
          }
        });
        socketRef.current = socket;

        const connectionTimeout = setTimeout(() => {
          if (!connected && !fallbackTriggered && !isCancelled) {
            fallbackTriggered = true;
            try { socket.disconnect(); } catch {}
            runViaHttpFallback(term);
          }
        }, 2000);

        socket.on('connect_error', () => {
          if (!fallbackTriggered && !isCancelled) {
            clearTimeout(connectionTimeout);
            fallbackTriggered = true;
            try { socket.disconnect(); } catch {}
            runViaHttpFallback(term);
          }
        });

        socket.on('connect', () => {
          connected = true;
          clearTimeout(connectionTimeout);
          socket.emit('execute', { code, language });
        });

        socket.on('output', (data: string) => {
          if (!isCancelled) term.write(data);
        });

        socket.on('finished', () => {
          if (!isCancelled) {
            setRunning(false);
            try { socket.disconnect(); } catch {}
          }
        });

        onDataDisposableRef.current = term.onData((data: string) => {
          if (socket.connected) {
            socket.emit('input', data);
          }
        });

        setTimeout(() => {
          if (!isCancelled) setRunning(false);
        }, 30000);

      } catch (err: any) {
        if (!isCancelled) {
          if (xtermRef.current) {
            xtermRef.current.writeln(`\r\n\x1b[31mExecution Error: ${err.message || 'Unknown'}\x1b[0m\r\n`);
          }
          setRunning(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [runTrigger]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  const handleKill = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch {}
      socketRef.current = null;
    }
    setRunning(false);
    if (xtermRef.current) {
      xtermRef.current.writeln('\r\n\x1b[31m[Process stopped by user]\x1b[0m\r\n');
    }
  };

  return (
    <div style={{
      height: open ? '300px' : '38px',
      borderTop: '1px solid #1e2230',
      background: '#090a0f',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      transition: 'height 0.2s ease',
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
    }}>
      {/* Terminal Title Bar */}
      <div
        onClick={onToggle}
        style={{
          height: '38px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: '#10121a',
          borderBottom: '1px solid #1a1d28',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* macOS window control circles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em', fontFamily: 'Söhne Mono, monospace' }}>
            terminal ~ {language.toLowerCase()}
          </span>
          {running && (
            <span style={{
              fontSize: '10px',
              fontFamily: 'Söhne Mono, monospace',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              ● Executing...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {open && (
            <>
              <button
                onClick={handleClear}
                style={{
                  padding: '3px 8px',
                  background: '#1e2230',
                  border: '1px solid #2d3348',
                  borderRadius: '3px',
                  color: '#cbd5e1',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
              {running && (
                <button
                  onClick={handleKill}
                  style={{
                    padding: '3px 8px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '3px',
                    color: '#f87171',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Kill
                </button>
              )}
            </>
          )}
          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '4px' }}>
            {open ? '▼' : '▲'}
          </span>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: open ? 'flex' : 'none',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#090a0f'
      }}>
        <div 
          ref={terminalRef} 
          style={{ flex: 1, padding: '10px 14px', background: '#090a0f', overflow: 'hidden' }}
        />
      </div>
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
