'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminQuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchQuizzes = async () => {
    try {
      const res = await fetch('/api/admin/quizzes', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data.quizzes || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleCopyLink = (slug: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://code.zealindori.com';
    const link = `${origin}/${slug}`;
    navigator.clipboard.writeText(link);
    setCopySuccess(slug);
    setTimeout(() => setCopySuccess(null), 2500);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete quiz "${title}"? This cannot be undone.`)) return;

    try {
      const res = await fetch('/api/admin/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'delete_quiz', id }),
      });
      if (res.ok) {
        fetchQuizzes();
      }
    } catch (err) {
      alert('Failed to delete quiz');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      const res = await fetch('/api/admin/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'update_quiz', id, status: newStatus }),
      });
      if (res.ok) {
        fetchQuizzes();
      }
    } catch (err) {
      alert('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)', fontFamily: 'Söhne Mono, monospace' }}>
        Loading Quizzes...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px', color: 'var(--accent)', fontWeight: 600 }}>Assessments</p>
          <h1 style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
            Quiz Tests
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Create and manage MCQ, Fill in the Blank, and Odd One Out assessments with custom mobile links.
          </p>
        </div>

        <button
          onClick={() => router.push('/admin/quizzes/create')}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            padding: '12px 22px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 6px rgba(204, 120, 92, 0.25)',
          }}
        >
          <span>+</span> Create New Quiz
        </button>
      </div>

      {/* Quizzes List */}
      {quizzes.length === 0 ? (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px dashed var(--border)',
            borderRadius: '8px',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>📝</div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No quizzes created yet
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
            Create your first quiz with MCQs, fill-in-the-blanks, or odd-one-out questions. Students can take it smoothly on mobile and desktop!
          </p>
          <button
            onClick={() => router.push('/admin/quizzes/create')}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Create Quiz Now
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {quizzes.map(quiz => {
            const questionCount = quiz.quizQuestions?.length || 0;
            const sessionCount = quiz._count?.examSessions || 0;
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://code.zealindori.com';
            const testUrl = `${origin}/${quiz.unique_id}`;

            return (
              <div
                key={quiz.id}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Top Row: Title, Status, and Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {quiz.title}
                      </h2>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: quiz.status === 'PUBLISHED' ? 'var(--success-dim)' : 'var(--surface-2)',
                          color: quiz.status === 'PUBLISHED' ? 'var(--success)' : 'var(--text-muted)',
                          border: `1px solid ${quiz.status === 'PUBLISHED' ? 'var(--success)' : 'var(--border)'}`,
                        }}
                      >
                        {quiz.status}
                      </span>
                      {quiz.auto_approve && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(204, 120, 92, 0.12)',
                            color: 'var(--accent)',
                          }}
                        >
                          Auto-Approve Active
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      {quiz.subject?.name || 'General'} · {quiz.duration_minutes} mins · {quiz.total_marks} marks · {questionCount} questions
                      {quiz.target_division ? ` · Div ${quiz.target_division}` : ''}
                    </p>

                    {/* Custom Link Box */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        marginTop: '4px',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Custom Link:
                      </span>
                      <a
                        href={testUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '13px',
                          color: 'var(--accent)',
                          fontFamily: 'Söhne Mono, monospace',
                          textDecoration: 'none',
                          fontWeight: 500,
                        }}
                      >
                        {testUrl}
                      </a>
                      <button
                        onClick={() => handleCopyLink(quiz.unique_id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: copySuccess === quiz.unique_id ? 'var(--success)' : 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '2px 6px',
                        }}
                      >
                        {copySuccess === quiz.unique_id ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => router.push(`/admin/quizzes/${quiz.id}/questions`)}
                      style={{
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      Questions ({questionCount})
                    </button>

                    <button
                      onClick={() => router.push(`/admin/quizzes/${quiz.id}/results`)}
                      style={{
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'var(--surface-2)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      Results ({sessionCount})
                    </button>

                    <button
                      onClick={() => handleToggleStatus(quiz.id, quiz.status)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      {quiz.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    </button>

                    <button
                      onClick={() => handleDelete(quiz.id, quiz.title)}
                      style={{
                        padding: '8px 10px',
                        fontSize: '12px',
                        color: 'var(--error)',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '5px',
                        cursor: 'pointer',
                      }}
                      title="Delete Quiz"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
