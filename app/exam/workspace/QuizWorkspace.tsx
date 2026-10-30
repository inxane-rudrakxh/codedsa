'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Clock, Flag, ChevronLeft, ChevronRight, Send, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface QuizQuestion {
  id: string;
  order_index: number;
  type: string;
  question_text: string;
  code_snippet?: string | null;
  options: string[];
  marks: number;
  explanation?: string;
  correct_answer?: string;
}

interface QuizWorkspaceProps {
  session: {
    id: string;
    test_title: string;
    test_instructions?: string;
    duration_minutes: number;
    total_marks: number;
    remaining_seconds: number;
    integrity_warnings: number;
    marks_published: boolean;
  };
  student: {
    roll_no: string;
    name: string;
    branch?: string;
    division?: string;
  };
  questions: QuizQuestion[];
  initialAnswers: Record<string, { selected_answer?: string }>;
}

export default function QuizWorkspace({ session, student, questions, initialAnswers }: QuizWorkspaceProps) {
  const router = useRouter();

  // Active question index
  const [activeIdx, setActiveIdx] = useState(0);

  // Student answers map: question_id -> string answer
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    Object.entries(initialAnswers || {}).forEach(([qid, val]) => {
      if (val?.selected_answer) map[qid] = val.selected_answer;
    });
    // Check localStorage fallback
    if (typeof window !== 'undefined') {
      try {
        const savedLocal = localStorage.getItem(`quiz_answers_${session.id}`);
        if (savedLocal) {
          const parsed = JSON.parse(savedLocal);
          Object.assign(map, parsed);
        }
      } catch {}
    }
    return map;
  });

  // Marked for review set
  const [reviewSet, setReviewSet] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`quiz_review_${session.id}`);
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set();
  });

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState(session.remaining_seconds || 1800);

  // Anti-cheat / Alt-Tab warnings
  const [warningCount, setWarningCount] = useState(session.integrity_warnings || 0);
  const warningCountRef = useRef(session.integrity_warnings || 0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);

  // Submit confirmation modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Proctoring armed ref
  const proctoringArmedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('session_token') || '' : '';

  const currentQ = questions[activeIdx] || questions[0];

  // ── Auto-save function ────────────────────────────────────────────────────
  const persistAnswer = useCallback(async (qid: string, ans: string) => {
    setSaveStatus('saving');
    try {
      // LocalStorage backup
      if (typeof window !== 'undefined') {
        const currentLocal = JSON.parse(localStorage.getItem(`quiz_answers_${session.id}`) || '{}');
        currentLocal[qid] = ans;
        localStorage.setItem(`quiz_answers_${session.id}`, JSON.stringify(currentLocal));
      }

      await fetch('/api/exam/quiz/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ question_id: qid, answer: ans }),
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('idle');
    }
  }, [session.id]);

  const handleAnswerChange = (val: string) => {
    if (!currentQ) return;
    const newAnswers = { ...answers, [currentQ.id]: val };
    setAnswers(newAnswers);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistAnswer(currentQ.id, val);
    }, 400);
  };

  const toggleReview = (qid: string) => {
    setReviewSet(prev => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`quiz_review_${session.id}`, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  // ── Submit Exam Function ──────────────────────────────────────────────────
  const handleSubmitExam = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/exam/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`quiz_answers_${session.id}`);
          localStorage.removeItem(`quiz_review_${session.id}`);
        }
        router.push('/result');
      } else {
        alert('Submission failed. Please check your network and try again.');
        setSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      alert('Error submitting test. Please try again.');
      setSubmitting(false);
    }
  }, [submitting, answers, router, session.id]);

  // ── Proctoring Violation Handler ──────────────────────────────────────────
  const reportIntegrity = useCallback(async (event_type: 'tab_switch' | 'fullscreen_exit') => {
    if (!proctoringArmedRef.current || isAutoSubmitting) return;

    try {
      const res = await fetch('/api/exam/integrity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ event_type }),
      });
      const data = await res.json();
      if (!res.ok) return;

      const newCount = data.warning_count || (warningCountRef.current + 1);
      warningCountRef.current = newCount;
      setWarningCount(newCount);

      if (newCount >= 3 || data.auto_submitted) {
        setIsAutoSubmitting(true);
        setWarningMessage('VIOLATION LIMIT REACHED (3/3): You have switched tabs or exited fullscreen 3 times. Your exam is now being automatically submitted.');
        setShowWarningModal(true);
        setTimeout(() => {
          handleSubmitExam();
        }, 2200);
      } else {
        const remaining = 3 - newCount;
        setWarningMessage(
          `WARNING ${newCount} OF 3: Tab switch or window blur detected. You have ${remaining} warning${remaining > 1 ? 's' : ''} left. On the 3rd violation, your exam will be automatically submitted.`
        );
        setShowWarningModal(true);
      }
    } catch (err) {
      console.error('Integrity reporting error:', err);
    }
  }, [isAutoSubmitting, handleSubmitExam]);

  // Arm proctoring & register event listeners
  useEffect(() => {
    const timer = setTimeout(() => {
      proctoringArmedRef.current = true;
    }, 3000);

    const onBlur = () => {
      reportIntegrity('tab_switch');
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        reportIntegrity('tab_switch');
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportIntegrity('fullscreen_exit');
      }
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Prevent context menu and copy
    const prevent = (e: Event) => {
      e.preventDefault();
      return false;
    };
    window.addEventListener('contextmenu', prevent);
    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('contextmenu', prevent);
      document.removeEventListener('copy', prevent);
      document.removeEventListener('cut', prevent);
    };
  }, [reportIntegrity]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0) {
      handleSubmitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, handleSubmitExam]);

  // Format time display
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isTimeCritical = timeRemaining < 300; // < 5 mins
  const isTimeEmergency = timeRemaining < 120; // < 2 mins

  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim() !== '').length;
  const unansweredCount = questions.length - answeredCount;
  const reviewCount = reviewSet.size;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', color: 'var(--text-primary)' }}>
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header style={{
        height: '64px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
          }}>
            CODE//ZEAL
          </span>
          <span style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {session.test_title}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Violation / Anti-cheat Counter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '4px',
            background: warningCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--surface-2)',
            border: `1px solid ${warningCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
            fontSize: '12px',
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            color: warningCount > 0 ? '#ef4444' : 'var(--text-secondary)',
          }}>
            <ShieldAlert size={14} />
            <span>Violations: {warningCount} / 3</span>
          </div>

          {/* Live Countdown Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px',
            borderRadius: '6px',
            background: isTimeEmergency ? 'rgba(239, 68, 68, 0.15)' : (isTimeCritical ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-2)'),
            border: `1px solid ${isTimeEmergency ? 'rgba(239, 68, 68, 0.5)' : (isTimeCritical ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)')}`,
            color: isTimeEmergency ? '#ef4444' : (isTimeCritical ? '#f59e0b' : 'var(--text-primary)'),
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            fontSize: '15px',
            fontWeight: 700,
          }}>
            <Clock size={16} />
            <span>{timeFormatted}</span>
          </div>

          {/* Student badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            background: 'var(--surface-2)',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            fontSize: '12px',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.roll_no}</span>
            <span style={{ color: 'var(--text-muted)' }}>({student.name.split(' ')[0]})</span>
          </div>

          {/* Submit Exam Button */}
          <button
            onClick={() => setShowSubmitModal(true)}
            style={{
              background: '#22c55e',
              color: '#ffffff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'opacity 0.15s ease',
            }}
          >
            <Send size={14} /> Submit Exam
          </button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE CONTENT ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Question and Answer Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
            {/* Question Header Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  fontFamily: 'Söhne Mono, ui-monospace, monospace',
                  color: 'var(--text-primary)',
                }}>
                  Question {activeIdx + 1} of {questions.length}
                </span>
                <span style={{
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}>
                  {currentQ?.marks} {currentQ?.marks === 1 ? 'Mark' : 'Marks'}
                </span>
                <span style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                }}>
                  {currentQ?.type?.replace('_', ' ')}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Auto-save indicator */}
                <span style={{
                  fontSize: '11px',
                  color: saveStatus === 'saving' ? 'var(--warning)' : 'var(--text-muted)',
                  fontFamily: 'Söhne Mono, ui-monospace, monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  {saveStatus === 'saving' ? 'Saving...' : 'Saved ✓'}
                </span>

                {/* Mark for review toggle */}
                <button
                  onClick={() => toggleReview(currentQ.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    background: reviewSet.has(currentQ.id) ? 'rgba(168, 85, 247, 0.15)' : 'var(--surface-2)',
                    border: `1px solid ${reviewSet.has(currentQ.id) ? 'rgba(168, 85, 247, 0.4)' : 'var(--border)'}`,
                    color: reviewSet.has(currentQ.id) ? '#a855f7' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Flag size={13} fill={reviewSet.has(currentQ.id) ? '#a855f7' : 'none'} />
                  {reviewSet.has(currentQ.id) ? 'Marked' : 'Mark for Review'}
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div style={{ marginBottom: '24px' }}>
              <p style={{
                fontSize: '16px',
                lineHeight: 1.6,
                fontWeight: 500,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
              }}>
                {currentQ?.question_text}
              </p>
            </div>

            {/* Code Snippet / Diagram Container if present */}
            {currentQ?.code_snippet && (
              <div style={{
                marginBottom: '28px',
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '16px 20px',
                overflowX: 'auto',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
              }}>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'Söhne Mono, ui-monospace, monospace',
                  color: '#8b949e',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}>
                  Reference Code / Diagram:
                </div>
                <pre style={{
                  margin: 0,
                  fontFamily: 'Fira Code, Söhne Mono, ui-monospace, monospace',
                  fontSize: '13.5px',
                  lineHeight: 1.55,
                  color: '#58a6ff',
                  whiteSpace: 'pre-wrap',
                }}>
                  {currentQ.code_snippet}
                </pre>
              </div>
            )}

            {/* ── Answer Input Area ────────────────────────────────────────── */}
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '24px',
              marginBottom: '32px',
            }}>
              <p style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: '16px',
              }}>
                Your Answer:
              </p>

              {/* If MCQ */}
              {currentQ?.type === 'MCQ' && currentQ.options && currentQ.options.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {currentQ.options.map((opt, i) => {
                    const optLetter = String.fromCharCode(65 + i);
                    const isSelected = answers[currentQ.id] === opt || answers[currentQ.id] === optLetter;
                    return (
                      <div
                        key={i}
                        onClick={() => handleAnswerChange(opt)}
                        style={{
                          padding: '14px 18px',
                          borderRadius: '6px',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isSelected ? 'var(--accent)' : 'var(--surface-1)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'Söhne Mono, ui-monospace, monospace',
                          fontSize: '12px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {optLetter}
                        </span>
                        <span style={{
                          fontSize: '14px',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 600 : 400,
                          lineHeight: 1.4,
                        }}>
                          {opt}
                        </span>
                        {isSelected && (
                          <Check size={16} color="var(--accent)" style={{ marginLeft: 'auto' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Short Answer / Puzzle Output / Textarea */
                <div>
                  <textarea
                    value={answers[currentQ?.id] || ''}
                    onChange={e => handleAnswerChange(e.target.value)}
                    placeholder="Type your answer, output, or statement here..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontFamily: 'Fira Code, Söhne Mono, ui-monospace, monospace',
                      fontSize: '14px',
                      lineHeight: 1.5,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Auto-saves as you type</span>
                    {answers[currentQ?.id] && (
                      <button
                        onClick={() => handleAnswerChange('')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontSize: '11px',
                        }}
                      >
                        Clear answer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Navigation Buttons ────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setActiveIdx(prev => Math.max(0, prev - 1))}
                disabled={activeIdx === 0}
                style={{
                  padding: '10px 18px',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: activeIdx === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: activeIdx === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                {activeIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setActiveIdx(prev => Math.min(questions.length - 1, prev + 1))}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '6px',
                      background: 'var(--accent)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Next Question <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowSubmitModal(true)}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '6px',
                      background: '#22c55e',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Finish & Submit <Send size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Question Palette & Overview ────────────────────────────── */}
        <aside style={{
          width: '320px',
          borderLeft: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 20px',
          gap: '20px',
          overflowY: 'auto',
        }}>
          <div>
            <p style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '12px',
            }}>
              Question Palette
            </p>

            {/* Quick Stat badges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
              <div style={{ padding: '8px 12px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                <p style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>Answered</p>
                <p style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Söhne Mono, ui-monospace, monospace', color: '#22c55e' }}>{answeredCount}</p>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: '4px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Remaining</p>
                <p style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Söhne Mono, ui-monospace, monospace', color: 'var(--text-secondary)' }}>{unansweredCount}</p>
              </div>
            </div>

            {/* Question Buttons Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              marginBottom: '24px',
            }}>
              {questions.map((q, idx) => {
                const hasAnswer = answers[q.id]?.trim() !== '' && answers[q.id] !== undefined;
                const isMarked = reviewSet.has(q.id);
                const isCurrent = idx === activeIdx;

                let bg = 'var(--surface-2)';
                let color = 'var(--text-secondary)';
                let borderColor = 'var(--border)';

                if (isMarked) {
                  bg = 'rgba(168, 85, 247, 0.2)';
                  color = '#c084fc';
                  borderColor = '#a855f7';
                } else if (hasAnswer) {
                  bg = 'rgba(34, 197, 94, 0.2)';
                  color = '#4ade80';
                  borderColor = '#22c55e';
                }

                if (isCurrent) {
                  borderColor = 'var(--accent, #3b82f6)';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveIdx(idx)}
                    style={{
                      height: '42px',
                      borderRadius: '6px',
                      background: bg,
                      border: `2px solid ${isCurrent ? 'var(--accent, #3b82f6)' : borderColor}`,
                      color: color,
                      fontSize: '13px',
                      fontWeight: 700,
                      fontFamily: 'Söhne Mono, ui-monospace, monospace',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      boxShadow: isCurrent ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none',
                    }}
                  >
                    {idx + 1}
                    {isMarked && (
                      <span style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: '#a855f7',
                      }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e' }} />
                <span>Answered</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid #a855f7' }} />
                <span>Marked for Review</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
                <span>Not Answered</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── ANTI-CHEAT / ALT-TAB WARNING MODAL ───────────────────────────────── */}
      {showWarningModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: 'var(--surface-1)',
            border: `2px solid ${isAutoSubmitting ? '#ef4444' : '#f59e0b'}`,
            borderRadius: '8px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: isAutoSubmitting ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: isAutoSubmitting ? '#ef4444' : '#f59e0b',
            }}>
              <AlertTriangle size={32} />
            </div>

            <h3 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: isAutoSubmitting ? '#ef4444' : '#f59e0b',
              marginBottom: '12px',
            }}>
              {isAutoSubmitting ? 'Exam Auto-Submitted' : `Integrity Warning (${warningCount}/3)`}
            </h3>

            <p style={{
              fontSize: '14px',
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
              marginBottom: '24px',
            }}>
              {warningMessage}
            </p>

            {!isAutoSubmitting && (
              <button
                onClick={() => setShowWarningModal(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                I Understand & Return to Test
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── SUBMIT CONFIRMATION MODAL ────────────────────────────────────────── */}
      {showSubmitModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '460px',
            width: '100%',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Confirm Exam Submission
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to finish and submit your exam? You will not be able to modify your answers after submitting.
            </p>

            {/* Summary */}
            <div style={{
              background: 'var(--surface-2)',
              borderRadius: '6px',
              padding: '14px 18px',
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '13px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Questions:</span>
                <span style={{ fontWeight: 600 }}>{questions.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#22c55e' }}>Answered:</span>
                <span style={{ fontWeight: 600, color: '#22c55e' }}>{answeredCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: unansweredCount > 0 ? '#ef4444' : 'var(--text-muted)' }}>Unanswered:</span>
                <span style={{ fontWeight: 600, color: unansweredCount > 0 ? '#ef4444' : 'inherit' }}>{unansweredCount}</span>
              </div>
              {reviewCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#a855f7' }}>Marked for Review:</span>
                  <span style={{ fontWeight: 600, color: '#a855f7' }}>{reviewCount}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
                style={{
                  padding: '10px 18px',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Continue Reviewing
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                style={{
                  padding: '10px 22px',
                  borderRadius: '6px',
                  background: '#22c55e',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
