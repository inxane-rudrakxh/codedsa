'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import { exitFullscreenSafely } from '@/lib/inAppClipboard';

interface ResultData {
  student: { roll_no: string; name: string; division: string; branch: string };
  questions: Array<{ id: string; title: string; order_index: number }>;
  submissions: Array<{ question_id: string; score: number | null; submitted_at: string }>;
  total_score: number | null;
  submitted_at: string | null;
  marks_published: boolean;
}

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    exitFullscreenSafely();
    const token = localStorage.getItem('session_token');

    if (!token) { router.push('/'); return; }

    fetch('/api/exam/session', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (!d.session) { router.push('/'); return; }

        const questions = d.questions || [];
        const submissionMap: Record<string, any> = d.submissions || {};
        const submissions = Object.entries(submissionMap).map(([qid, s]) => ({
          question_id: qid,
          score: s.marks_awarded ?? null,
          submitted_at: s.created_at,
        }));

        const totalScore = d.session?.marks_published 
          ? submissions.reduce((acc, s) => acc + (s.score || 0), 0)
          : null;

        setData({
          student: d.student,
          questions,
          submissions,
          total_score: totalScore,
          submitted_at: d.session.end_time || new Date().toISOString(),
          marks_published: d.session?.marks_published || false,
        });
        setLoading(false);
      })
      .catch(() => router.push('/'));
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', color: 'var(--text-muted)', fontSize: '13px' }}>Loading results...</p>
      </div>
    );
  }

  if (!data) return null;

  const scoreMap: Record<string, number | null> = {};
  data.submissions.forEach(s => { scoreMap[s.question_id] = s.score; });

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
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
        <span className="text-label">Exam Complete</span>
      </header>

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
      }}>
        <div className="animate-fade-up" style={{ maxWidth: '520px', width: '100%' }}>
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
              <Check size={13} strokeWidth={2.5} /> Submitted Successfully
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
            {data.student.name}
          </h1>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            marginBottom: '28px',
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
          }}>
            Roll {data.student.roll_no} · Division {data.student.division} {data.student.branch ? `· ${data.student.branch}` : ''}
          </p>

          {/* Score display or Official Announcement */}
          {data.marks_published && data.total_score !== null ? (
            <div style={{
              padding: '24px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '8px',
              marginBottom: '32px',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                Your Score
              </p>
              <h2 style={{ fontSize: '42px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Söhne Mono, ui-monospace, monospace', margin: 0 }}>
                {data.total_score} <span style={{ fontSize: '20px', color: 'var(--text-muted)', fontWeight: 500 }}>/ 30</span>
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0 }}>
                Assessment completed and verified.
              </p>
            </div>
          ) : (
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
                Your exam responses have been securely saved and submitted. 
                The official results and evaluation marksheet will be published once faculty verification is completed.
              </p>
            </div>
          )}

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
              {data.submissions.length} / {data.questions.length} Attempted
            </span>
          </div>

          <div style={{ marginBottom: '28px', borderTop: '1px solid var(--border)' }}>
            {data.questions.map((q, i) => {
              const hasSubmission = data.submissions.some(s => s.question_id === q.id);
              return (
                <div key={q.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  <div>
                    <p style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginBottom: '3px',
                      fontFamily: 'Söhne Mono, ui-monospace, monospace',
                    }}>
                      Question {String(i + 1).padStart(2, '0')}
                    </p>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>
                      {q.title}
                    </p>
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
              {data.submitted_at && (
                <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, margin: '2px 0 0', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>
                  {new Date(data.submitted_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} strokeWidth={2} /> Safe to close this tab
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
