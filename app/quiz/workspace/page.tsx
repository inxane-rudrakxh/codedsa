'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SanitizedQuestion {
  id: string;
  order_index: number;
  type: 'MCQ' | 'FILL_BLANK' | 'ODD_ONE_OUT';
  question_text: string;
  options: string[];
  marks: number;
}

export default function QuizWorkspacePage() {
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [questions, setQuestions] = useState<SanitizedQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showPaletteDrawer, setShowPaletteDrawer] = useState<boolean>(false);
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('session_token') || '' : '';

  // Load session
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/');
      return;
    }

    fetch('/api/quiz/session', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Session invalid');
        return res.json();
      })
      .then(data => {
        if (data.session?.is_submitted || data.session?.status === 'submitted' || data.session?.status === 'EXPIRED') {
          router.push('/quiz/result');
          return;
        }

        setSession(data.session);
        setStudent(data.student);
        setQuestions(data.questions || []);
        setRemainingSeconds(data.session?.remaining_seconds || 1800);

        // Load saved answers from DB and merge with localStorage backup
        const dbAnswers = data.saved_answers || {};
        const localKey = `quiz_answers_${data.session?.id}`;
        try {
          const cached = JSON.parse(localStorage.getItem(localKey) || '{}');
          setAnswers({ ...cached, ...dbAnswers });
        } catch {
          setAnswers(dbAnswers);
        }

        const reviewKey = `quiz_reviewed_${data.session?.id}`;
        try {
          const cachedRev = JSON.parse(localStorage.getItem(reviewKey) || '{}');
          setReviewed(cachedRev);
        } catch {}

        setLoading(false);
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  // Countdown Timer
  useEffect(() => {
    if (loading || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, remainingSeconds]);

  // Tab switch listener
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitchCount(p => p + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Save answer to API + localStorage
  const saveAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers(prev => {
      const updated = { ...prev, [questionId]: answer };
      if (session?.id) {
        localStorage.setItem(`quiz_answers_${session.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    // Debounced API save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const token = getToken();
      if (!token) return;
      try {
        await fetch('/api/quiz/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question_id: questionId, selected_answer: answer }),
        });
      } catch (err) {
        console.warn('Silent save error', err);
      }
    }, 400);
  }, [session?.id]);

  const toggleReview = (questionId: string) => {
    setReviewed(prev => {
      const updated = { ...prev, [questionId]: !prev[questionId] };
      if (session?.id) {
        localStorage.setItem(`quiz_reviewed_${session.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const clearAnswer = (questionId: string) => {
    saveAnswer(questionId, '');
  };

  const handleAutoSubmit = () => {
    handleSubmit(true);
  };

  const handleSubmit = async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);

    const token = getToken();
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (res.ok) {
        if (session?.id) {
          localStorage.removeItem(`quiz_answers_${session.id}`);
          localStorage.removeItem(`quiz_reviewed_${session.id}`);
        }
        router.push('/quiz/result');
      } else {
        alert(data.error || 'Failed to submit quiz');
        setSubmitting(false);
      }
    } catch {
      alert('Network error during submission. Retrying...');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Söhne Mono, monospace', color: 'var(--text-muted)', fontSize: '14px' }}>Loading Quiz Assessment...</p>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  if (!currentQ) return null;

  const currentAns = answers[currentQ.id] || '';
  const isReviewed = !!reviewed[currentQ.id];

  // Stats calculation
  const totalQuestions = questions.length;
  const answeredCount = questions.filter(q => (answers[q.id] || '').trim() !== '').length;
  const unansweredCount = totalQuestions - answeredCount;
  const reviewCount = Object.values(reviewed).filter(Boolean).length;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Format Timer MM:SS
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const isTimeCritical = remainingSeconds < 300; // Under 5 min

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      
      {/* TOP STICKY BAR */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Left: Brand & Quiz title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontFamily: 'Söhne Mono, monospace', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            CODE//ZEAL
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
            {session?.test_title || 'Quiz'}
          </span>
        </div>

        {/* Center: Question indicator / Drawer trigger */}
        <button
          onClick={() => setShowPaletteDrawer(true)}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
          title="Open Question Palette"
        >
          <span>Q {currentIndex + 1}/{totalQuestions}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>▾</span>
        </button>

        {/* Right: Timer & Submit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              fontFamily: 'Söhne Mono, monospace',
              fontSize: '14px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '6px',
              background: isTimeCritical ? 'var(--error-dim)' : 'var(--surface-2)',
              color: isTimeCritical ? 'var(--error)' : 'var(--text-primary)',
              border: `1px solid ${isTimeCritical ? 'var(--error)' : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⏱</span>
            <span>{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            style={{
              padding: '6px 14px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Submit
          </button>
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div style={{ width: '100%', height: '3px', background: 'var(--surface-2)' }}>
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: 'var(--accent)',
            transition: 'width 0.25s ease',
          }}
        />
      </div>

      {/* MAIN CONTAINER: Responsive layout for Mobile & Desktop */}
      <div style={{ flex: 1, display: 'flex', maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '16px 16px 90px 16px', gap: '24px' }}>
        
        {/* DESKTOP SIDEBAR QUESTION PALETTE (Hidden on mobile) */}
        <aside
          className="desktop-palette"
          style={{
            width: '240px',
            display: 'none',
            flexDirection: 'column',
            gap: '16px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '20px',
            height: 'fit-content',
            position: 'sticky',
            top: '70px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Questions Overview
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {answeredCount} of {totalQuestions} answered ({progressPercent}%)
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {questions.map((q, idx) => {
              const hasAns = (answers[q.id] || '').trim() !== '';
              const isRev = !!reviewed[q.id];
              const isCurrent = idx === currentIndex;

              let bg = 'var(--surface-2)';
              let color = 'var(--text-secondary)';
              let border = '1px solid var(--border)';

              if (hasAns) {
                bg = 'var(--accent-dim)';
                color = 'var(--accent)';
                border = '1px solid var(--accent)';
              }
              if (isRev) {
                bg = 'rgba(232, 165, 90, 0.2)';
                color = 'var(--warning)';
                border = '1px solid var(--warning)';
              }
              if (isCurrent) {
                border = '2px solid var(--text-primary)';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    height: '36px',
                    borderRadius: '6px',
                    background: bg,
                    color: color,
                    border: border,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--accent-dim)', border: '1px solid var(--accent)' }} />
              <span>Answered ({answeredCount})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(232, 165, 90, 0.2)', border: '1px solid var(--warning)' }} />
              <span>Marked for Review ({reviewCount})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
              <span>Unanswered ({unansweredCount})</span>
            </div>
          </div>
        </aside>

        {/* QUESTION DISPLAY CARD */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            {/* Question Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: 'Söhne Mono, monospace',
                    background: 'var(--accent)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Q{currentIndex + 1}
                </span>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: currentQ.type === 'MCQ' ? 'var(--success-dim)' : currentQ.type === 'ODD_ONE_OUT' ? 'var(--warning-dim)' : 'var(--accent-dim)',
                    color: currentQ.type === 'MCQ' ? 'var(--success)' : currentQ.type === 'ODD_ONE_OUT' ? 'var(--warning)' : 'var(--accent)',
                  }}
                >
                  {currentQ.type === 'MCQ' ? 'Multiple Choice' : currentQ.type === 'ODD_ONE_OUT' ? 'Odd One Out' : 'Fill in the Blank'}
                </span>
              </div>

              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                +{currentQ.marks} Mark{currentQ.marks > 1 ? 's' : ''}
              </span>
            </div>

            {/* Question Text */}
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>
              {currentQ.question_text}
            </div>

            {/* INTERACTIVE INPUT AREA */}

            {/* 1. MCQ Options */}
            {currentQ.type === 'MCQ' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentQ.options.map((opt, oIdx) => {
                  const letter = String.fromCharCode(65 + oIdx);
                  const isSelected = currentAns === opt || currentAns === letter;

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => saveAnswer(currentQ.id, opt)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '8px',
                        background: isSelected ? 'var(--accent-dim)' : 'var(--surface-2)',
                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isSelected ? 'var(--accent)' : 'var(--surface-1)',
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {letter}
                      </div>

                      <span style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: isSelected ? 600 : 400 }}>
                        {opt}
                      </span>

                      {isSelected && (
                        <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontWeight: 700, fontSize: '16px' }}>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. Fill in the Blank Input */}
            {currentQ.type === 'FILL_BLANK' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Type your answer in the box below:
                </label>
                <input
                  type="text"
                  value={currentAns}
                  onChange={e => saveAnswer(currentQ.id, e.target.value)}
                  placeholder="Type answer here..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'var(--surface-2)',
                    border: '1.5px solid var(--border)',
                    fontSize: '16px',
                    color: 'var(--text-primary)',
                    fontFamily: 'Söhne, sans-serif',
                  }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Note: Answer is case-insensitive.
                </p>
              </div>
            )}

            {/* 3. Odd One Out Items */}
            {currentQ.type === 'ODD_ONE_OUT' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Select the item that does NOT belong with the others:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {currentQ.options.map((opt, oIdx) => {
                    const isSelected = currentAns === opt;

                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => saveAnswer(currentQ.id, opt)}
                        style={{
                          padding: '16px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(232, 165, 90, 0.2)' : 'var(--surface-2)',
                          border: `1.5px solid ${isSelected ? 'var(--warning)' : 'var(--border)'}`,
                          textAlign: 'center',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ fontSize: '16px', fontWeight: isSelected ? 700 : 500, color: 'var(--text-primary)' }}>
                          {opt}
                        </span>
                        {isSelected ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>
                            ★ Selected as Odd One
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Tap to choose
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile Question Quick Bar (Swipe / Tap numbers) */}
            <div style={{ marginTop: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {questions.map((q, idx) => {
                  const hasAns = (answers[q.id] || '').trim() !== '';
                  const isRev = !!reviewed[q.id];
                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      style={{
                        minWidth: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: isCurrent ? '2px solid var(--text-primary)' : '1px solid var(--border)',
                        background: isRev ? 'rgba(232, 165, 90, 0.2)' : hasAns ? 'var(--accent-dim)' : 'var(--surface-2)',
                        color: isRev ? 'var(--warning)' : hasAns ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* FIXED FOOTER CONTROLS (Sticky on Mobile & Desktop) */}
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--surface-1)',
          borderTop: '1px solid var(--border)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 90,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
            disabled={currentIndex === 0}
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: currentIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Prev
          </button>

          <button
            onClick={() => toggleReview(currentQ.id)}
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              background: isReviewed ? 'rgba(232, 165, 90, 0.2)' : 'transparent',
              border: `1px solid ${isReviewed ? 'var(--warning)' : 'var(--border)'}`,
              color: isReviewed ? 'var(--warning)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isReviewed ? '★ Reviewed' : '☆ Review Later'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {currentAns && (
            <button
              onClick={() => clearAnswer(currentQ.id)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}

          {currentIndex < totalQuestions - 1 ? (
            <button
              onClick={() => setCurrentIndex(p => p + 1)}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => setShowSubmitModal(true)}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                background: 'var(--success)',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Finish & Submit ✓
            </button>
          )}
        </div>
      </footer>

      {/* MOBILE DRAWER / QUESTION PALETTE MODAL */}
      {showPaletteDrawer && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div
            style={{
              background: 'var(--surface-1)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              padding: '24px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Question Palette
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {answeredCount} Answered · {unansweredCount} Unanswered · {reviewCount} Review
                </p>
              </div>

              <button
                onClick={() => setShowPaletteDrawer(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {questions.map((q, idx) => {
                const hasAns = (answers[q.id] || '').trim() !== '';
                const isRev = !!reviewed[q.id];
                const isCurrent = idx === currentIndex;

                let bg = 'var(--surface-2)';
                let color = 'var(--text-secondary)';
                let border = '1px solid var(--border)';

                if (hasAns) {
                  bg = 'var(--accent-dim)';
                  color = 'var(--accent)';
                  border = '1.5px solid var(--accent)';
                }
                if (isRev) {
                  bg = 'rgba(232, 165, 90, 0.2)';
                  color = 'var(--warning)';
                  border = '1.5px solid var(--warning)';
                }
                if (isCurrent) {
                  border = '2px solid var(--text-primary)';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowPaletteDrawer(false);
                    }}
                    style={{
                      height: '44px',
                      borderRadius: '8px',
                      background: bg,
                      color: color,
                      border: border,
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setShowPaletteDrawer(false);
                setShowSubmitModal(true);
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Review & Submit Assessment
            </button>
          </div>
        </div>
      )}

      {/* SUBMISSION CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 300 }}>
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
            
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Submit Quiz Assessment?
            </h3>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Are you sure you want to finish and submit your answers?
            </p>

            <div style={{ background: 'var(--surface-2)', borderRadius: '8px', padding: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>{answeredCount}</span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Answered</span>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }} />
              <div>
                <span style={{ fontSize: '18px', fontWeight: 700, color: unansweredCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{unansweredCount}</span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining</span>
              </div>
              <div style={{ width: '1px', background: 'var(--border)' }} />
              <div>
                <span style={{ fontSize: '18px', fontWeight: 700, color: reviewCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{reviewCount}</span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Review</span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <p style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 500, marginBottom: '20px' }}>
                ⚠️ You still have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}.
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Return to Quiz
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inject desktop palette media query */}
      <style jsx>{`
        @media (min-width: 768px) {
          .desktop-palette {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
