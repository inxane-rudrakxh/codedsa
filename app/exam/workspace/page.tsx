'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AlertTriangle, ShieldAlert, Check, Info, Terminal, CheckCircle, Square, Sparkles, Maximize } from 'lucide-react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
import QuizWorkspace from './QuizWorkspace';

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
    test_type?: string;
    total_marks?: number;
    duration_minutes?: number;
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
  quiz_questions?: any[];
  quiz_answers?: Record<string, string>;
  submissions: Record<number, Submission>;
  saves: Record<number, string>;
  // language_id per question from CodeDraft (2=cpp,3=python,4=java,1=c)
  saveLangs?: Record<number, number>;
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
  const [submittingQid, setSubmittingQid] = useState<number | null>(null);
  const [confirmQuestionId, setConfirmQuestionId] = useState<number | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showFinishExamModal, setShowFinishExamModal] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [integrityWarning, setIntegrityWarning] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isFullscreenViolation, setIsFullscreenViolation] = useState(false);
  const hasEnteredFullscreenRef = useRef(false);
  const proctoringArmedRef = useRef(false);
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

  // ── Stable refs for stale-closure elimination ─────────────────────────────
  // These are kept current on every render so event listeners and intervals
  // can safely read the latest values without being in their dep arrays.
  const codesRef = useRef<Record<number, string>>({});
  const activeQuestionRef = useRef<number>(0);
  const sessionDataRef = useRef<SessionData | null>(null);
  const loadingRef = useRef<boolean>(true);
  const sessionLoadedRef = useRef<boolean>(false); // proctoring registered once
  const autoSubmitRef = useRef<(() => Promise<void>) | null>(null);

  // Keep refs in sync with state on every render
  codesRef.current = codes;
  activeQuestionRef.current = activeQuestion;
  sessionDataRef.current = sessionData;
  loadingRef.current = loading;

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
        const allQuestionsDone = (data.questions || []).length > 0 &&
          (data.questions || []).every(q => Boolean(data.submissions?.[q.id]));
        if (data.session.is_submitted && allQuestionsDone) {
          setShowFinalScreen(true);
        }
        setSessionData(data);
        setTimeRemaining(data.session.remaining_seconds);
        const warnings = Number(data.session.integrity_warnings) || 0;
        setWarningCount(warnings);
        warningCountRef.current = warnings;

        // Auto-submit if session already exceeded 3 violations
        if (warnings >= 3) {
          setTabSwitchReason('3 violations detected. Your exam has been auto-submitted.');
          setShowTabSwitchModal(true);
          // autoSubmitRef will be populated after handleAutoSubmit is defined below
          setTimeout(() => { autoSubmitRef.current?.(); }, 2500);
          return;
        }
        
        const allowedLangs = data.session.allowed_languages || ['cpp', 'c', 'python', 'java'];

        // ── Language recovery ─────────────────────────────────────────────
        // Restore the language the student was last using per-question.
        // saveLangs maps question_id → language_id (1=c, 2=cpp, 3=python, 4=java).
        const langIdToName: Record<number, string> = { 1: 'c', 2: 'cpp', 3: 'python', 4: 'java' };
        // Pick an initial global language: the most recently used among saved langs,
        // or the first allowed lang, or cpp as last resort.
        let restoredLang = allowedLangs.includes('cpp') ? 'cpp' : (allowedLangs[0] || 'cpp');
        if (data.saveLangs) {
          const savedLangIds = Object.values(data.saveLangs);
          if (savedLangIds.length > 0) {
            const lastName = langIdToName[savedLangIds[savedLangIds.length - 1]];
            if (lastName && allowedLangs.includes(lastName)) restoredLang = lastName;
          }
        }
        setLanguage(restoredLang);

        // Initialize codes from local drafts or server saves
        const initialCodes: Record<number, string> = {};
        data.questions.forEach(q => {
          const localDraft = typeof window !== 'undefined' ? localStorage.getItem(`code_draft_${data.session.id}_${q.id}`) : null;
          // Prefer local draft (latest keystroke), then server save, then starter for the restored lang
          initialCodes[q.id] = localDraft || data.saves[q.id] || STARTER_CODES[restoredLang] || STARTER_CODES.cpp;
        });
        setCodes(initialCodes);

        // Check fullscreen status on session load
        if (typeof document !== 'undefined') {
          if (document.fullscreenElement) {
            hasEnteredFullscreenRef.current = true;
            setShowFullscreenPrompt(false);
            setIsFullscreenViolation(false);
            setTimeout(() => {
              if (typeof document !== 'undefined' && document.fullscreenElement) {
                proctoringArmedRef.current = true;
              }
            }, 4000);
          } else {
            hasEnteredFullscreenRef.current = false;
            proctoringArmedRef.current = false;
            setIsFullscreenViolation(false);
            setShowFullscreenPrompt(true);
          }
        }

        // Restore submission scores
        const scores: Record<string, number> = {};
        Object.entries(data.submissions).forEach(([qid, sub]) => {
          scores[qid] = (sub as any).score;
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

  // Timer countdown — reads from autoSubmitRef so the stale closure (Bug 5) is eliminated.
  useEffect(() => {
    if (!sessionData || loading) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Use the ref so this closure always calls the latest handleAutoSubmit
          autoSubmitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session.id, loading]);

  // Auto-save every 5 seconds
  // Bug 4 fix: reads from stable refs so the interval is created ONCE per session
  // and does NOT reset every time the student types a character.
  useEffect(() => {
    if (!sessionData || loading) return;

    const autoSave = () => {
      // Read latest values from refs — safe inside an interval
      const sd = sessionDataRef.current;
      const aq = activeQuestionRef.current;
      if (!sd) return;
      const question = sd.questions[aq];
      if (!question) return;
      const code = codesRef.current[question.id];
      if (!code) return;

      // Don't save if already submitted
      if (sd.submissions[question.id]) return;

      fetch('/api/exam/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ question_id: question.id, code, language }),
      })
        .then(async r => {
          if (r.status === 403) {
            setShowFinalScreen(true);
            return;
          }
          const data = await r.json();
          if (data?.stopped) {
            setShowFinalScreen(true);
          } else if (data?.success) {
            setSavedAt(new Date());
          }
        })
        .catch(() => {});
    };

    saveTimerRef.current = setInterval(autoSave, 5000);
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session.id, loading]);

  // Periodic poll to detect instructor stopping the exam in real-time
  useEffect(() => {
    if (!sessionData || loading || showFinalScreen) return;

    const interval = setInterval(() => {
      const token = getToken();
      if (!token) return;
      fetch('/api/exam/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          const allQuestionsDone = (data?.questions || []).length > 0 &&
            (data?.questions || []).every((q: any) => Boolean(data?.submissions?.[q.id]));
          if (data?.session?.status === 'stopped' || data?.session?.status === 'expired' || (data?.session?.is_submitted && allQuestionsDone)) {
            setShowFinalScreen(true);
          }
        })
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionData, loading, showFinalScreen, getToken]);

  // ── Proctoring: 3 warnings → auto-submit ─────────────────────────────────
  // Only two events count as warnings:
  //   1. fullscreen_exit — leaving fullscreen
  //   2. tab_switch      — switching tab or app
  // External paste is silently blocked. Screenshots/F11 are silently suppressed.

  // Bug 3 & 13 fix: reads from stable refs; only increments warningCountRef AFTER server confirms.
  const reportIntegrity = useCallback(async (event_type: 'fullscreen_exit' | 'tab_switch') => {
    if (!sessionDataRef.current || loadingRef.current) return;
    // CRITICAL: Never record violations if proctoring is not yet armed (e.g. initial test entry/grace period)
    if (!proctoringArmedRef.current) return;

    // Persist to DB FIRST — only count it if the server accepted it
    try {
      const res = await fetch('/api/exam/integrity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ event_type }),
      });
      if (!res.ok) return; // server rejected it — don't increment local count
    } catch {
      // Network failure — don't increment (will retry next violation)
      return;
    }

    warningCountRef.current += 1;
    const newCount = warningCountRef.current;
    setWarningCount(newCount);

    // Auto-submit on 3rd violation
    if (newCount >= 3) {
      setTabSwitchReason('3 violations detected. Your exam has been auto-submitted.');
      setShowTabSwitchModal(true);
      setTimeout(() => autoSubmitRef.current?.(), 2500);
      return;
    }

    if (event_type === 'fullscreen_exit') {
      setShowFullscreenPrompt(true);
    } else {
      // tab_switch
      setTabSwitchReason('You switched to another tab or application.');
      setShowTabSwitchModal(true);
    }
  }, [getToken]);

  // Register proctoring event listeners ONCE after session loads (Bug 2 fix).
  // sessionLoadedRef prevents re-registration on every autosave / timer re-render.
  useEffect(() => {
    if (!sessionData || loading) return;
    if (sessionLoadedRef.current) return; // already registered
    sessionLoadedRef.current = true;

    // ── 1. Fullscreen & Keyboard Lock ─────────────────────────────────────
    const lockKeyboard = async () => {
      try {
        if (typeof navigator !== 'undefined' && 'keyboard' in navigator && (navigator as any).keyboard?.lock) {
          await (navigator as any).keyboard.lock([
            'AltLeft',
            'AltRight',
            'Tab',
            'Escape',
            'MetaLeft',
            'MetaRight',
            'ContextMenu'
          ]);
        }
      } catch {}
    };

    // Initial check on mount: if already in fullscreen (e.g. from instructions page), arm after grace period
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      hasEnteredFullscreenRef.current = true;
      setShowFullscreenPrompt(false);
      setIsFullscreenViolation(false);
      lockKeyboard();
      setTimeout(() => {
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          proctoringArmedRef.current = true;
        }
      }, 4000);
    } else {
      hasEnteredFullscreenRef.current = false;
      proctoringArmedRef.current = false;
      setIsFullscreenViolation(false);
      setShowFullscreenPrompt(true);
    }

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // Exited fullscreen
        if (proctoringArmedRef.current) {
          // Genuine violation during active exam
          setIsFullscreenViolation(true);
          reportIntegrity('fullscreen_exit');
        } else {
          // Still in entry / grace period: NOT a violation
          setIsFullscreenViolation(false);
        }
        setShowFullscreenPrompt(true);
      } else {
        // Re-entered fullscreen
        hasEnteredFullscreenRef.current = true;
        setShowFullscreenPrompt(false);
        setIsFullscreenViolation(false);
        lockKeyboard();
        // Give a 3-second settling window after entering before arming proctoring
        setTimeout(() => {
          if (typeof document !== 'undefined' && document.fullscreenElement) {
            proctoringArmedRef.current = true;
          }
        }, 3000);
      }
    };

    // ── 2. Tab / window / app switch detection ─────────────────────────────
    let lastSwitchReportAt = 0;
    const triggerTabSwitch = () => {
      if (!proctoringArmedRef.current) return;
      const now = Date.now();
      if (now - lastSwitchReportAt < 1200) return; // debounce
      lastSwitchReportAt = now;
      reportIntegrity('tab_switch');
    };

    // Fires whenever the browser window loses focus (Alt+Tab, app switch, clicking outside, etc.)
    const onWindowBlur = () => {
      if (!proctoringArmedRef.current) return;
      setTimeout(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          triggerTabSwitch();
        }
      }, 200);
    };

    // Fires whenever the document is hidden/backgrounded
    const onVisibilityChange = () => {
      if (!proctoringArmedRef.current) return;
      if (document.visibilityState === 'hidden') {
        triggerTabSwitch();
      }
    };

    // ── 3. Intercept shortcut keys ─────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const { key, code, ctrlKey, metaKey, shiftKey, altKey } = e;

      // Intercept Alt+Tab or Alt combinations
      const isAltTab = (altKey && (key === 'Tab' || code === 'Tab')) || (key === 'Tab' && altKey);
      if (isAltTab) {
        e.preventDefault();
        e.stopPropagation();
        triggerTabSwitch();
        return;
      }

      if (key === 'Alt') {
        e.preventDefault();
        e.stopPropagation();
      }

      // Block copy, cut, paste shortcuts
      const isCopy  = (ctrlKey || metaKey) && (key === 'c' || key === 'C');
      const isCut   = (ctrlKey || metaKey) && (key === 'x' || key === 'X');
      const isPaste = (ctrlKey || metaKey) && (key === 'v' || key === 'V');
      if (isCopy || isCut || isPaste) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Block inspect / devtools shortcuts
      const isDevTools =
        key === 'F12' ||
        ((ctrlKey || metaKey) && shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key)) ||
        ((ctrlKey || metaKey) && (key === 'U' || key === 'u'));
      if (isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Silently suppress screenshot keys — these don't count as violations
      const isPrintScreen = key === 'PrintScreen' || code === 'PrintScreen';
      const isWinSnip     = (metaKey || ctrlKey) && shiftKey && (key === 'S' || key === 's');
      const isMacShot     = metaKey && shiftKey && ['3', '4', '5'].includes(key);
      const isF11         = key === 'F11' || code === 'F11';

      if (isPrintScreen || isWinSnip || isMacShot) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isF11) {
        e.preventDefault();
        e.stopPropagation();
        if (!document.fullscreenElement) {
          setShowFullscreenPrompt(true);
        }
      }
    };

    // ── 4. Block right-click, copy, cut, and paste ────────────────────────
    const preventClipboardAndContext = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('contextmenu', preventClipboardAndContext, { capture: true });
    document.addEventListener('contextmenu', preventClipboardAndContext, { capture: true });
    document.addEventListener('copy', preventClipboardAndContext, { capture: true });
    document.addEventListener('cut', preventClipboardAndContext, { capture: true });
    document.addEventListener('paste', preventClipboardAndContext, { capture: true });

    // Note: cleanup on unmount only. Re-registration is guarded by sessionLoadedRef.
    return () => {
      sessionLoadedRef.current = false;
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('contextmenu', preventClipboardAndContext, { capture: true });
      document.removeEventListener('contextmenu', preventClipboardAndContext, { capture: true });
      document.removeEventListener('copy', preventClipboardAndContext, { capture: true });
      document.removeEventListener('cut', preventClipboardAndContext, { capture: true });
      document.removeEventListener('paste', preventClipboardAndContext, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session.id, loading]);

  // Bug 1 & 5 fix: wrapped in useCallback with stable codesRef so stale closures
  // inside timers and integrity handlers always call the latest version.
  const handleAutoSubmit = useCallback(async () => {
    const sd = sessionDataRef.current;
    if (!sd) return;
    for (const q of sd.questions) {
      if (!sd.submissions[q.id]) {
        await doSubmit(q.id, codesRef.current[q.id] || STARTER_CODE);
      }
    }
    router.push('/result');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Keep the ref in sync so timers always call the latest handleAutoSubmit
  autoSubmitRef.current = handleAutoSubmit;

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

  const handleSubmitQuestion = async (targetQid?: number) => {
    if (!sessionData) return;
    const qid = targetQid ?? confirmQuestionId ?? sessionData.questions[activeQuestion]?.id;
    if (!qid) return;
    const question = sessionData.questions.find(q => q.id === qid);
    if (!question) return;

    setSubmitting(true);
    setSubmittingQid(qid);
    setShowSubmitConfirm(false);
    setConfirmQuestionId(null);
    try {
      const code = codes[qid] || codesRef.current[qid] || STARTER_CODES[language] || STARTER_CODES.cpp;
      const score = await doSubmit(qid, code);
      // Update local session data
      setSessionData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          submissions: {
            ...prev.submissions,
            [qid]: { score: score, submitted_at: new Date().toISOString() },
          },
        };
      });
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
      setSubmittingQid(null);
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

  if (sessionData.session.test_type === 'QUIZ' || sessionData.session.test_type === 'PUZZLE') {
    return (
      <QuizWorkspace
        session={sessionData.session as any}
        student={sessionData.student}
        questions={((sessionData as any).quiz_questions || sessionData.questions) as any}
        initialAnswers={((sessionData as any).quiz_answers || {}) as any}
      />
    );
  }

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
        isStopped={sessionData.session.status === 'stopped'}
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
        onFinishExam={() => setShowFinishExamModal(true)}
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
              background: isFullscreenViolation ? 'rgba(204, 120, 92, 0.14)' : 'rgba(56, 189, 248, 0.14)',
              border: `1px solid ${isFullscreenViolation ? 'rgba(204, 120, 92, 0.35)' : 'rgba(56, 189, 248, 0.35)'}`,
              color: isFullscreenViolation ? '#cc785c' : '#38bdf8',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              fontFamily: 'StyreneB, Inter, sans-serif'
            }}>
              {isFullscreenViolation ? <ShieldAlert size={14} /> : <Maximize size={14} />}
              {isFullscreenViolation ? 'Security & Integrity Lock' : 'Assessment Environment'}
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
              {isFullscreenViolation ? 'Fullscreen Mode Required' : 'Enter Fullscreen to Begin Exam'}
            </h2>

            <p style={{
              fontFamily: 'StyreneB, Inter, sans-serif',
              fontSize: '14px',
              color: '#a09d96',
              lineHeight: 1.6,
              marginBottom: isFullscreenViolation ? '24px' : '28px',
              maxWidth: '440px'
            }}>
              {isFullscreenViolation
                ? 'Exiting fullscreen is not allowed during the assessment. This violation has been recorded. Further violations will be logged silently.'
                : 'This examination requires fullscreen mode for secure proctoring and a distraction-free coding workspace. Please click below to enter fullscreen and begin your assessment.'}
            </p>

            {/* Warning counter pill (only shown if an actual violation occurred) */}
            {isFullscreenViolation && (
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
            )}

            <button
              onClick={() => {
                if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
                  document.documentElement.requestFullscreen().then(() => {
                    hasEnteredFullscreenRef.current = true;
                    setShowFullscreenPrompt(false);
                    setIsFullscreenViolation(false);
                    setTimeout(() => {
                      if (typeof document !== 'undefined' && document.fullscreenElement) {
                        proctoringArmedRef.current = true;
                      }
                    }, 3000);
                    try {
                      if ('keyboard' in navigator && (navigator as any).keyboard?.lock) {
                        (navigator as any).keyboard.lock(['Escape', 'F11', 'AltLeft', 'AltRight', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu']).catch(() => {});
                      }
                    } catch {}
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
              {isFullscreenViolation ? 'Return to Fullscreen & Resume Exam' : 'Enter Fullscreen & Begin Exam'}
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
              <AlertTriangle size={14} /> Assessment Focus Notice
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
                <div
                  key={q.id}
                  onClick={() => setActiveQuestion(index)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    marginBottom: '6px',
                    background: active ? 'var(--surface-2)' : 'transparent',
                    border: `1px solid ${active ? 'var(--border)' : 'transparent'}`,
                    borderRadius: '6px',
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
                      fontWeight: 600,
                    }}>
                      Q{String(index + 1).padStart(2, '0')}
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
                    marginBottom: '8px',
                  }}>
                    {q.title}
                  </p>

                  {/* Individual Question Submit Button inside sidebar item */}
                  {!submitted ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveQuestion(index);
                        setConfirmQuestionId(q.id);
                        setShowSubmitConfirm(true);
                      }}
                      disabled={submitting}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        background: active ? '#ffffff' : 'rgba(255, 255, 255, 0.06)',
                        color: active ? '#000000' : 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <CheckCircle size={11} strokeWidth={2.5} />
                      {submitting && submittingQid === q.id ? 'Submitting...' : `Submit Q${index + 1}`}
                    </button>
                  ) : (
                    <div style={{
                      fontSize: '10px',
                      fontFamily: 'Söhne Mono, ui-monospace, monospace',
                      color: 'var(--success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <Check size={11} strokeWidth={2.5} />
                      <span>Submitted ({submitScores[q.id] ?? 0}/10)</span>
                    </div>
                  )}
                </div>
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
                  <QuestionPanel
                    question={currentQuestion}
                    index={activeQuestion}
                    isSubmitted={isSubmitted}
                    score={submitScores[currentQuestion.id]}
                    submitting={submitting && submittingQid === currentQuestion.id}
                    onSubmit={() => {
                      setConfirmQuestionId(currentQuestion.id);
                      setShowSubmitConfirm(true);
                    }}
                  />
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
                        <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={12} strokeWidth={2.5} /> SUBMITTED · {submitScores[currentQuestion.id] ?? 0}/10
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
                            onClick={() => {
                              setConfirmQuestionId(currentQuestion.id);
                              setShowSubmitConfirm(true);
                            }}
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
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <CheckCircle size={13} strokeWidth={2.5} />
                            {submitting && submittingQid === currentQuestion.id
                              ? `Submitting Q${activeQuestion + 1}...`
                              : `Submit Q${activeQuestion + 1}`}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Monaco Editor — key=questionId forces full remount on question switch,
                      preventing code from bleeding across questions */}
                  <div
                    data-editor="true"
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
                        setCodes(prev => {
                          const next = { ...prev, [currentQuestion.id]: val || '' };
                          if (typeof window !== 'undefined' && sessionData?.session?.id) {
                            localStorage.setItem(`code_draft_${sessionData.session.id}_${currentQuestion.id}`, val || '');
                          }
                          return next;
                        });
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
                        // Suppress spurious onChange that Monaco fires on first mount.
                        editorMountingRef.current = true;
                        setTimeout(() => { editorMountingRef.current = false; }, 150);

                        // Disable right-click context menu in Monaco
                        editor.onContextMenu((e) => {
                          e.event.preventDefault();
                          e.event.stopPropagation();
                        });

                        // Disable Monaco clipboard commands
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {});
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {});
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {});

                        // Ctrl+Enter → Run Code
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                          if (!isSubmitted) handleRunCode();
                        });

                        // Intercept keydown in Monaco — block Copy, Cut, Paste shortcuts
                        editor.onKeyDown((ke) => {
                          const isCopy  = (ke.ctrlKey || ke.metaKey) && ke.keyCode === monaco.KeyCode.KeyC;
                          const isCut   = (ke.ctrlKey || ke.metaKey) && ke.keyCode === monaco.KeyCode.KeyX;
                          const isPaste = (ke.ctrlKey || ke.metaKey) && ke.keyCode === monaco.KeyCode.KeyV;
                          if (isCopy || isCut || isPaste) {
                            ke.preventDefault();
                            ke.stopPropagation();
                          }
                        });

                        // Prevent contextmenu, copy, cut, paste on Monaco DOM node
                        const domNode = editor.getDomNode();
                        if (domNode) {
                          const blockDom = (e: Event) => {
                            e.preventDefault();
                            e.stopPropagation();
                          };
                          domNode.addEventListener('contextmenu', blockDom, { capture: true });
                          domNode.addEventListener('copy', blockDom, { capture: true });
                          domNode.addEventListener('cut', blockDom, { capture: true });
                          domNode.addEventListener('paste', blockDom, { capture: true });
                        }
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
                    exampleInput={sessionData?.testCases?.[currentQuestion?.id]?.[0]?.input || ''}
                    onRunCode={handleRunCode}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Individual Question Submit Confirmation Modal */}
      {showSubmitConfirm && (() => {
        const targetQid = confirmQuestionId ?? currentQuestion?.id;
        const targetQ = sessionData.questions.find(q => q.id === targetQid) || currentQuestion;
        const targetIdx = sessionData.questions.findIndex(q => q.id === targetQ?.id);
        if (!targetQ) return null;
        return (
          <Modal
            onClose={() => {
              setShowSubmitConfirm(false);
              setConfirmQuestionId(null);
            }}
            onConfirm={() => handleSubmitQuestion(targetQ.id)}
            questionTitle={targetQ.title}
            questionIndex={targetIdx >= 0 ? targetIdx : activeQuestion}
            submitting={submitting}
          />
        );
      })()}

      {/* Finish Exam Confirmation Modal */}
      {showFinishExamModal && (
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
          onClick={() => setShowFinishExamModal(false)}
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
              boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.85)',
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
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{
                fontFamily: 'Copernicus, "Tiempos Headline", "Georgia", serif',
                fontSize: '22px',
                fontWeight: 400,
                color: '#faf9f5',
                letterSpacing: '-0.3px',
                margin: '0 0 8px 0'
              }}>
                Finish Entire Exam?
              </h3>
              <p style={{
                fontFamily: 'StyreneB, Inter, sans-serif',
                fontSize: '14px',
                color: '#a09d96',
                lineHeight: 1.6,
                margin: 0
              }}>
                You have submitted {Object.keys(sessionData.submissions).length} of {sessionData.questions.length} questions. Finishing the exam will submit all your solutions and conclude your test session.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowFinishExamModal(false)}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: '#252320',
                  border: '1px solid rgba(230, 223, 216, 0.12)',
                  borderRadius: '8px',
                  color: '#faf9f5',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'StyreneB, Inter, sans-serif'
                }}
              >
                Keep Working
              </button>
              <button
                onClick={() => {
                  setShowFinishExamModal(false);
                  handleAutoSubmit();
                }}
                style={{
                  flex: 1.5,
                  padding: '11px 16px',
                  background: '#cc785c',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'StyreneB, Inter, sans-serif'
                }}
              >
                Submit All & Finish
              </button>
            </div>
          </div>
        </div>
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
  onFinishExam,
}: {
  student: { roll_no: string; name: string; division: string };
  timeRemaining: number;
  timerColor: string;
  timerState: string;
  savedAt: Date | null;
  warningCount: number;
  onFinishExam?: () => void;
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

        {onFinishExam && (
          <button
            onClick={onFinishExam}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'Söhne Mono, ui-monospace, monospace',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--text-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Finish Exam
          </button>
        )}
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
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'Söhne Mono, ui-monospace, monospace',
      }}><Check size={10} strokeWidth={2.5} /></span>
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

function QuestionPanel({
  question,
  index,
  isSubmitted,
  score,
  submitting,
  onSubmit,
}: {
  question: Question;
  index: number;
  isSubmitted?: boolean;
  score?: number;
  submitting?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <div style={{ userSelect: 'none' }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}>
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

      <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '3px', border: '1px solid var(--border)', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
          <Info size={13} style={{ flexShrink: 0 }} /> <span><strong style={{ color: 'var(--text-secondary)' }}>Note:</strong> You can use a hardcoded array or take input from the user.</span>
        </p>
      </div>

      {/* Individual Question Submit Section */}
      <div style={{
        padding: '16px',
        background: 'var(--surface-2)',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div>
          <p style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '2px',
          }}>
            {isSubmitted ? `Question ${index + 1} Submitted` : `Submit Solution for Q${index + 1}`}
          </p>
          <p style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            margin: 0,
          }}>
            {isSubmitted
              ? `Score: ${score !== undefined ? `${score}/10` : 'Recorded'}`
              : 'Submits this question only. You can continue working on other questions.'}
          </p>
        </div>

        {isSubmitted ? (
          <span style={{
            fontSize: '11px',
            color: 'var(--success)',
            fontWeight: 600,
            background: 'rgba(63, 185, 80, 0.1)',
            border: '1px solid rgba(63, 185, 80, 0.3)',
            padding: '4px 10px',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
          }}>
            <Check size={12} strokeWidth={2.5} /> Submitted
          </span>
        ) : (
          <button
            onClick={onSubmit}
            disabled={submitting}
            style={{
              padding: '6px 14px',
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: '#000000',
              fontSize: '11px',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <CheckCircle size={12} strokeWidth={2.5} />
            {submitting ? 'Submitting...' : `Submit Q${index + 1}`}
          </button>
        )}
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

// ── Helpers for Classic VS Code Style Interactive Terminal ─────────────────
function extractInteractivePrompts(code: string, language: string) {
  const lang = (language || 'cpp').toLowerCase();
  const prompts: string[] = [];

  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '');

  if (lang === 'cpp' || lang === 'c++' || lang === 'c') {
    const regex = /(?:(?:std::)?cout\s*<<\s*["\x27]([^"\x27\n\r]+)["\x27]|printf\s*\(\s*["\x27]([^"\x27\n\r]+)["\x27]\s*\))[\s\S]*?(?:(?:std::)?cin\s*>>|scanf\s*\(|getline\s*\(\s*(?:std::)?cin)/g;
    let match;
    while ((match = regex.exec(cleanCode)) !== null) {
      const p = match[1] || match[2] || '';
      if (p.trim()) prompts.push(p);
    }
  } else if (lang === 'python' || lang === 'py') {
    const regex = /input\s*\(\s*["\x27]([^"\x27\n\r]*)["\x27]\s*\)/g;
    let match;
    while ((match = regex.exec(cleanCode)) !== null) {
      if (match[1] && match[1].trim()) prompts.push(match[1]);
    }
  } else if (lang === 'java') {
    const regex = /System\.out\.print(?:ln)?\s*\(\s*["\x27]([^"\x27\n\r]+)["\x27]\s*\)\s*;[\s\S]*?(?:(?:[a-zA-Z0-9_]+)\.(?:next|readLine))/g;
    let match;
    while ((match = regex.exec(cleanCode)) !== null) {
      if (match[1] && match[1].trim()) prompts.push(match[1]);
    }
  }

  const hasRawInput = /\b(cin\s*>>|scanf\s*\(|getline\s*\(\s*(?:std::)?cin|getchar\s*\(|input\s*\(|Scanner\b|System\.in|readline\b)/.test(cleanCode);

  return { prompts, hasRawInput };
}

function getRemainingOutput(fullOutput: string, promptsCount: number): string {
  if (!fullOutput) return '';
  const lines = fullOutput.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length > promptsCount) {
    return lines.slice(promptsCount).join('\n');
  }
  return '';
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
  exampleInput?: string;
  onRunCode?: () => void;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);

  const awaitingInputRef = useRef<boolean>(false);
  const inputResolverRef = useRef<((val: string) => void) | null>(null);
  const currentLineBufferRef = useRef<string>('');

  const runningRef = useRef(running);
  runningRef.current = running;

  // Stable refs for props to eliminate stale closures on question switch (Bug 6 fix)
  const codeRef = useRef(code);
  codeRef.current = code;
  const languageRef = useRef(language);
  languageRef.current = language;
  const questionIdRef = useRef(questionId);
  questionIdRef.current = questionId;
  const exampleInputRef = useRef(exampleInput);
  exampleInputRef.current = exampleInput;
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // ── Build the xterm instance once with direct interactive input (VS Code style) ──
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

    // Direct in-terminal keystroke handling (VS Code architecture)
    term.onData((data: string) => {
      if (!awaitingInputRef.current) return;

      // Ignore escape sequences (arrow keys, etc.) to prevent garbage chars
      if (data.startsWith('\x1b')) return;

      // Handle Ctrl+C (\x03)
      if (data === '\x03') {
        term.write('^C\r\n');
        awaitingInputRef.current = false;
        currentLineBufferRef.current = '';
        if (inputResolverRef.current) {
          const resolver = inputResolverRef.current;
          inputResolverRef.current = null;
          resolver('');
        }
        return;
      }

      // Handle Enter (\r or \n)
      if (data === '\r' || data === '\n') {
        term.write('\r\n');
        const line = currentLineBufferRef.current;
        currentLineBufferRef.current = '';
        awaitingInputRef.current = false;
        if (inputResolverRef.current) {
          const resolver = inputResolverRef.current;
          inputResolverRef.current = null;
          resolver(line);
        }
        return;
      }

      // Handle Backspace (\x7f or \x08)
      if (data === '\x7f' || data === '\x08') {
        if (currentLineBufferRef.current.length > 0) {
          currentLineBufferRef.current = currentLineBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
        return;
      }

      // Handle printable characters or pasted text
      if (data >= ' ' || data.includes('\n')) {
        currentLineBufferRef.current += data;
        term.write(data.replace(/\r?\n/g, '\r\n'));
        return;
      }
    });

    const ro = new ResizeObserver(() => {
      try { fitAddonRef.current?.fit(); } catch {}
    });
    ro.observe(el);

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

  // Prompt the user for input directly in xterm at the cursor (cin)
  const promptForInput = (term: any, promptText?: string): Promise<string> => {
    return new Promise((resolve) => {
      if (promptText) {
        const formattedPrompt = promptText.replace(/\\n/g, '\r\n').replace(/\\t/g, '\t');
        term.write(formattedPrompt + (formattedPrompt.endsWith(' ') || formattedPrompt.endsWith('\r\n') ? '' : ' '));
      }
      currentLineBufferRef.current = '';
      awaitingInputRef.current = true;
      inputResolverRef.current = resolve;
      term.focus();
    });
  };

  // ── Execution via onlinecompiler.io with interactive stdin support ────────
  const executeCode = async (term: any) => {
    const currCode = codeRef.current;
    const currLang = languageRef.current;
    const currQid = questionIdRef.current;
    const currGetToken = getTokenRef.current;
    const exInput = exampleInputRef.current || '';

    // 1. Analyze code for interactive prompts (cout before cin)
    const { prompts, hasRawInput } = extractInteractivePrompts(currCode, currLang);

    const collectedInputs: string[] = [];

    // 2. Interactively collect inputs directly in the terminal (VS Code style)
    if (prompts.length > 0) {
      for (const p of prompts) {
        if (!runningRef.current) break;
        const val = await promptForInput(term, p);
        collectedInputs.push(val);
      }
    } else if (hasRawInput) {
      // Raw cin/scanf with no prompt text
      let promptMsg = '';
      if (exInput) {
        promptMsg = `\x1b[38;5;244m[Enter input (or press Enter for sample)]: \x1b[0m`;
      }
      const val = await promptForInput(term, promptMsg);
      if (!val.trim() && exInput) {
        collectedInputs.push(exInput);
      } else {
        collectedInputs.push(val);
      }
    }

    if (!runningRef.current) return;

    const effectiveInput = collectedInputs.length > 0 ? collectedInputs.join('\n') : (exInput || '');

    try {
      const token = currGetToken ? currGetToken() : '';
      const res = await fetch('/api/exam/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          code: currCode,
          language: currLang,
          question_id: currQid,
          input: effectiveInput,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        term.writeln(`\x1b[1;31m[Error] ${data.error || res.statusText || 'Execution failed'}\x1b[0m`);
      } else if (!data.success && data.compile_error) {
        term.writeln(`\x1b[1;31m[Compilation Error]\x1b[0m`);
        term.write(`\x1b[31m${data.compile_error.replace(/\r?\n/g, '\r\n')}\x1b[0m\r\n`);
      } else if (data.timed_out) {
        term.writeln(`\x1b[1;31m[Time Limit Exceeded]\x1b[0m\r\n`);
      } else {
        // Output from compiler: if prompts were already entered interactively in xterm,
        // extract and display only the remaining output that comes after the prompts!
        let outToDisplay = data.output || '';
        if (prompts.length > 0) {
          outToDisplay = getRemainingOutput(outToDisplay, prompts.length);
        }

        if (outToDisplay) {
          const rawOut = outToDisplay.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          term.write(rawOut.replace(/\n/g, '\r\n'));
        }
        if (data.stderr) {
          term.write(`\x1b[31m${data.stderr.replace(/\r?\n/g, '\r\n')}\x1b[0m\r\n`);
        }
      }
      term.write(`\x1b[38;5;240m\r\n[Process completed]\x1b[0m\r\n`);
    } catch (err: any) {
      term.writeln(`\x1b[1;31m[Error] ${err.message || 'Execution error'}\x1b[0m`);
    } finally {
      setRunning(false);
    }
  };

  // ── Main run effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (runTrigger === 0 || !codeRef.current) return;

    let cancelled = false;

    (async () => {
      const term = await ensureTerminal();
      if (!term) { setRunning(false); return; }
      if (cancelled) return;

      term.clear();
      setTimeout(() => fitAddonRef.current?.fit(), 30);
      term.focus();

      executeCode(term);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runTrigger]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    xtermRef.current?.clear();
  };

  const handleKill = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRunning(false);
    awaitingInputRef.current = false;
    if (inputResolverRef.current) {
      const resolver = inputResolverRef.current;
      inputResolverRef.current = null;
      resolver('');
    }
    xtermRef.current?.write('\r\n\x1b[38;5;240m[Cancelled]\x1b[0m\r\n');
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
      {/* Classic Title Bar */}
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
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#8b949e',
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
            <Terminal size={12} /> TERMINAL
          </span>
          {running && (
            <span style={{
              fontSize: '11px',
              color: '#58a6ff',
              fontFamily: 'Söhne Mono, monospace',
            }}>
              Running...
            </span>
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
              {running && (
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

      {/* xterm container — classic full-height terminal without extra boxes */}
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
  questionIndex,
  submitting,
}: {
  onClose: () => void;
  onConfirm: () => void;
  questionTitle: string;
  questionIndex?: number;
  submitting?: boolean;
}) {
  const qLabel = questionIndex !== undefined ? `Question ${questionIndex + 1}` : 'this question';
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
              <CheckCircle size={14} /> Submit {qLabel}
            </div>
            <h3 style={{
              fontFamily: 'Copernicus, "Tiempos Headline", "Georgia", "Iowan Old Style", serif',
              fontSize: '22px',
              fontWeight: 400,
              color: '#faf9f5',
              letterSpacing: '-0.3px',
              margin: 0
            }}>
              Submit {qLabel}?
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
          You are about to finalize and submit your solution for <strong style={{ color: '#faf9f5', fontWeight: 600 }}>{qLabel}: {questionTitle}</strong>. This submits only this individual question. Once submitted, your code for this question will be locked and evaluated, but you can continue solving and submitting your other questions.
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
            disabled={submitting}
            style={{
              flex: 1.5,
              padding: '11px 16px',
              background: '#cc785c',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'StyreneB, Inter, sans-serif',
              boxShadow: '0 4px 14px rgba(204, 120, 92, 0.35)',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#a9583e')}
            onMouseLeave={e => (e.currentTarget.style.background = '#cc785c')}
          >
            {submitting ? 'Submitting...' : `Confirm & Submit ${qLabel}`}
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
  isStopped,
}: {
  student: { roll_no: string; name: string; division: string };
  questions: Question[];
  submissions: Record<number, Submission>;
  submitScores: Record<number, number>;
  totalScore: number;
  isStopped?: boolean;
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
            color: isStopped ? 'var(--error, #e5534b)' : '#4e9a6e',
            background: isStopped ? 'rgba(229, 83, 75, 0.12)' : 'rgba(78, 154, 110, 0.12)',
            border: isStopped ? '1px solid rgba(229, 83, 75, 0.3)' : '1px solid rgba(78, 154, 110, 0.3)',
            padding: '4px 12px',
            borderRadius: '999px',
          }}>
            {isStopped ? (
              <>
                <Square size={12} fill="currentColor" />
                Exam Concluded by Faculty
              </>
            ) : (
              <>
                <Check size={13} strokeWidth={2.5} />
                Submitted Successfully
              </>
            )}
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
            <Sparkles size={16} style={{ color: 'var(--accent, #cc785c)' }} />
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  {hasSubmission ? (
                    <>
                      <Check size={12} strokeWidth={2.5} /> Submitted
                    </>
                  ) : '— Not Attempted'}
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
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Check size={12} strokeWidth={2} /> Safe to close this tab
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
