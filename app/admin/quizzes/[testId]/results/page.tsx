'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function QuizResultsPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;

  const [test, setTest] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchResults = async () => {
    try {
      const res = await fetch(`/api/admin/quizzes/${testId}/results`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const d = await res.json();
        setTest(d.test);
        setResults(d.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    const interval = setInterval(fetchResults, 8000);
    return () => clearInterval(interval);
  }, [testId]);

  const handleTogglePublish = async () => {
    const newStatus = !test?.marks_published;
    try {
      const res = await fetch(`/api/admin/quizzes/${testId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'toggle_publish', marks_published: newStatus }),
      });
      if (res.ok) {
        setTest((p: any) => ({ ...p, marks_published: newStatus }));
      }
    } catch {
      alert('Failed to update marks publish status');
    }
  };

  const handleDeleteSession = async (sessionId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to reset/delete the attempt for ${studentName}? The student will be able to retake the quiz.`)) return;

    try {
      const res = await fetch(`/api/admin/quizzes/${testId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'delete_session', session_id: sessionId }),
      });
      if (res.ok) {
        setSelectedStudent(null);
        fetchResults();
      }
    } catch {
      alert('Failed to reset attempt');
    }
  };

  const filtered = results.filter(r => {
    const q = search.toLowerCase();
    return (
      r.student.roll_no.toLowerCase().includes(q) ||
      r.student.name.toLowerCase().includes(q) ||
      r.student.division.toLowerCase().includes(q)
    );
  });

  const totalParticipants = results.length;
  const completedSubmissions = results.filter(r => r.is_submitted).length;
  const avgScore = totalParticipants > 0
    ? (results.reduce((acc, r) => acc + (r.score || 0), 0) / totalParticipants).toFixed(1)
    : '0';
  const highestScore = totalParticipants > 0
    ? Math.max(...results.map(r => r.score || 0))
    : 0;

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading Results...</div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/admin/quizzes" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Quizzes</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)' }}>{test?.title || 'Results'}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '6px' }}>
            {test?.title} — Results & Submissions
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Real-time submissions and auto-graded scores based on defined answers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleTogglePublish}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: test?.marks_published ? 'var(--success-dim)' : 'var(--surface-2)',
              color: test?.marks_published ? 'var(--success)' : 'var(--text-secondary)',
              border: `1px solid ${test?.marks_published ? 'var(--success)' : 'var(--border)'}`,
            }}
          >
            {test?.marks_published ? '✓ Marks Published to Students' : 'Publish Marks to Students'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Attempts</span>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{totalParticipants}</p>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Submitted</span>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>{completedSubmissions}</p>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Average Score</span>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>
            {avgScore} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {test?.total_marks}</span>
          </p>
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Highest Score</span>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
            {highestScore} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {test?.total_marks}</span>
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by student roll number, name, or division..."
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px 14px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Results Table */}
      {filtered.length === 0 ? (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No student attempts found.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Roll Number</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Div / Branch</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Score</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Correct / Total</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.session_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'Söhne Mono, monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {row.student.roll_no}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {row.student.name}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      Div {row.student.division} · {row.student.branch}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--accent)' }}>
                      {row.score} / {row.total_marks} ({row.percentage}%)
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {row.correct_count} / {row.total_questions}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: row.is_submitted ? 'var(--success-dim)' : 'var(--warning-dim)',
                          color: row.is_submitted ? 'var(--success)' : 'var(--warning)',
                        }}
                      >
                        {row.is_submitted ? 'SUBMITTED' : row.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedStudent(row)}
                        style={{
                          padding: '6px 12px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          marginRight: '8px',
                        }}
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => handleDeleteSession(row.session_id, row.student.name)}
                        style={{
                          padding: '6px 10px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: 'var(--error)',
                          cursor: 'pointer',
                        }}
                        title="Delete attempt to allow re-take"
                      >
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECT STUDENT ANSWERS MODAL */}
      {selectedStudent && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedStudent.student.name} ({selectedStudent.student.roll_no})
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Score: <strong style={{ color: 'var(--accent)' }}>{selectedStudent.score} / {selectedStudent.total_marks}</strong> ({selectedStudent.percentage}%) · {selectedStudent.correct_count}/{selectedStudent.total_questions} Correct
                </p>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {selectedStudent.answers.map((ans: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--surface-2)',
                    border: `1px solid ${ans.is_correct ? 'var(--success)' : 'var(--error)'}`,
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Question {idx + 1} ({ans.type})
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: ans.is_correct ? 'var(--success)' : 'var(--error)',
                      }}
                    >
                      {ans.is_correct ? `✓ +${ans.marks_awarded} Mark` : '✗ 0 Marks'}
                    </span>
                  </div>

                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                    {ans.question_text}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                    <div style={{ padding: '8px 10px', background: 'var(--surface-1)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Student Selected:</span>
                      <strong style={{ color: ans.is_correct ? 'var(--success)' : 'var(--error)' }}>
                        {ans.selected_answer || '(Unanswered)'}
                      </strong>
                    </div>

                    <div style={{ padding: '8px 10px', background: 'var(--surface-1)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', display: 'block' }}>Defined Answer:</span>
                      <strong style={{ color: 'var(--success)' }}>
                        {ans.correct_answer}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setSelectedStudent(null)}
                style={{
                  padding: '10px 18px',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
