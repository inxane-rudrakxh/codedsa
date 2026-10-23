'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function QuizResultPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('session_token') || '' : '';

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/');
      return;
    }

    // Fetch quiz session results
    fetch('/api/quiz/session', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load session');
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'Söhne Mono, monospace', color: 'var(--text-muted)', fontSize: '14px' }}>Loading Quiz Results...</p>
      </div>
    );
  }

  const { session, student, questions = [], saved_answers = {} } = data || {};
  const isMarksPublished = session?.marks_published ?? true;

  // Answers stats
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(saved_answers).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-1)',
        }}
      >
        <span style={{ fontFamily: 'Söhne Mono, monospace', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          CODE//ZEAL
        </span>
        {student && (
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'Söhne Mono, monospace' }}>
            {student.name} ({student.roll_no})
          </span>
        )}
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '680px', width: '100%', margin: '0 auto', padding: '32px 16px' }}>
        
        {/* Completion Card */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '32px 24px',
            textAlign: 'center',
            marginBottom: '28px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--success-dim)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 16px',
            }}
          >
            ✓
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Quiz Submitted Successfully
          </h1>
          
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {session?.test_title || 'Objective Assessment'}
          </p>

          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '18px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              textAlign: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Questions</span>
              <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{totalQuestions}</p>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Answered</span>
              <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', marginTop: '2px' }}>{answeredQuestions}</p>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Status</span>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)', marginTop: '6px', textTransform: 'uppercase' }}>
                Completed
              </p>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '20px' }}>
            Your responses have been recorded and saved.
          </p>
        </div>

        {/* Action Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => {
              localStorage.removeItem('session_token');
              router.push('/');
            }}
            style={{
              padding: '12px 28px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done / Exit Quiz
          </button>
        </div>

      </main>
    </div>
  );
}
