'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
        <p style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontSize: '13px' }}>Loading results...</p>
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
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.04em',
        }}>CODE//DSA</span>
        <span className="text-label">Exam Complete</span>
      </header>

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
      }}>
        <div className="animate-fade-up" style={{ maxWidth: '440px', width: '100%' }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--success)',
            }}>
              ✓ Test Complete
            </span>
          </div>

          <h1 style={{
            fontSize: '36px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            marginBottom: '4px',
          }}>
            {data.student.name}
          </h1>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            marginBottom: '48px',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            Roll {data.student.roll_no} · {data.student.division}
          </p>

          <div style={{ height: '1px', background: 'var(--border)', marginBottom: '32px' }} />

          <p className="text-label" style={{ marginBottom: '4px' }}>
            {data.submissions.length} / {data.questions.length} Questions Submitted
          </p>

          <div style={{ marginBottom: '32px' }}>
            {data.questions.map((q, i) => (
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
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    Q{String(i + 1).padStart(2, '0')}
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>{q.title}</p>
                </div>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: scoreMap[q.id] !== null && scoreMap[q.id] !== undefined ? 'var(--text-primary)' : 'var(--text-muted)',
                }}>
                  {data.marks_published && scoreMap[q.id] !== null && scoreMap[q.id] !== undefined ? scoreMap[q.id] : '—'}
                  {data.marks_published && <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>/10</span>}
                </span>
              </div>
            ))}
          </div>

          {!data.marks_published && (
            <div style={{ padding: '16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '32px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Scores are currently hidden. They will be available here once published by your teacher.
              </p>
            </div>
          )}

          {/* Total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            padding: '24px 0',
            borderTop: '1px solid var(--border)',
          }}>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Total Score</p>
              {data.submitted_at && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Submitted {new Date(data.submitted_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{
                fontSize: '48px',
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                color: data.marks_published ? 'var(--text-primary)' : 'var(--text-muted)',
                letterSpacing: '-0.02em',
              }}>
                {data.marks_published && data.total_score !== null ? data.total_score : '—'}
              </span>
              {data.marks_published && (
                <span style={{ fontSize: '20px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  /30
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
