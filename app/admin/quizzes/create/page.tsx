'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateQuizPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    unique_id: '',
    subject_name: 'Computer Graphics',
    duration_minutes: 30,
    total_marks: 10,
    target_division: '',
    instructions: 'Please answer all questions carefully. Choose the best answer for MCQs, type exact terms for blanks, and identify the odd item for odd-one-out questions.',
    auto_approve: true,
    raw_questions: '',
  });

  const [divisions, setDivisions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch('/api/admin/quizzes', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.divisions) setDivisions(d.divisions);
        if (d.subjects) setSubjects(d.subjects);
      })
      .catch(() => {});
  }, []);

  const handleGenerateSlug = () => {
    const base = formData.title
      ? formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 15).replace(/-+$/, '')
      : 'quiz';
    const rand = Math.random().toString(36).substring(2, 7);
    setFormData(p => ({ ...p, unique_id: `${base}-${rand}` }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Please provide a quiz title.');
      return;
    }

    setLoading(true);
    setError('');

    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch('/api/admin/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create_quiz',
          ...formData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create quiz');
        setLoading(false);
        return;
      }

      // If user provided raw questions text, bulk import them now
      if (formData.raw_questions && formData.raw_questions.trim()) {
        await fetch(`/api/admin/quizzes/${data.quiz.id}/questions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'bulk_import',
            raw_text: formData.raw_questions,
          }),
        });
      }

      router.push(`/admin/quizzes/${data.quiz.id}/questions`);
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://code.zealindori.com';
  const previewSlug = formData.unique_id.trim() || 'your-custom-slug';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/admin/quizzes" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Quizzes</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)' }}>Create Quiz</span>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <p className="text-label" style={{ marginBottom: '8px', color: 'var(--accent)', fontWeight: 600 }}>New Assessment</p>
        <h1 style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '8px' }}>
          Create Quiz Test
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Configure quiz parameters and generate a custom link for mobile & desktop test takers.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: '14px 18px',
            background: 'var(--error-dim)',
            border: '1px solid var(--error)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            marginBottom: '24px',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Title */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Quiz Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Computer Graphics & Visual Systems Quiz"
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '15px',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Custom Link / Slug Generator */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Custom Link / Slug
            </label>
            <button
              type="button"
              onClick={handleGenerateSlug}
              style={{
                fontSize: '12px',
                color: 'var(--accent)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Generate Random Slug
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'Söhne Mono, monospace' }}>
              {origin}/
            </span>
            <input
              type="text"
              value={formData.unique_id}
              onChange={e => setFormData({ ...formData, unique_id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })}
              placeholder="puzzle (or leave blank to auto-generate)"
              style={{
                flex: 1,
                padding: '12px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'Söhne Mono, monospace',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Students will visit: <strong style={{ color: 'var(--accent)' }}>{origin}/{previewSlug}</strong> on their phone or laptop.
          </p>
        </div>

        {/* Configuration Grid */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {/* Subject */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Subject Name
            </label>
            <input
              type="text"
              value={formData.subject_name}
              onChange={e => setFormData({ ...formData, subject_name: e.target.value })}
              placeholder="e.g. Computer Graphics"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Duration */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Duration (Minutes)
            </label>
            <input
              type="number"
              min="1"
              max="300"
              value={formData.duration_minutes}
              onChange={e => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Total Marks */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Total Marks
            </label>
            <input
              type="number"
              min="1"
              value={formData.total_marks}
              onChange={e => setFormData({ ...formData, total_marks: parseInt(e.target.value) || 10 })}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Target Division */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Target Division (Optional)
            </label>
            <select
              value={formData.target_division}
              onChange={e => setFormData({ ...formData, target_division: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">All Divisions</option>
              {divisions.map(d => (
                <option key={d.id} value={d.name}>Division {d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Auto-Approve Toggle */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Instant Auto-Approve on Mobile
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              When enabled, students entering their roll number start immediately without waiting for teacher approval.
            </p>
          </div>
          <input
            type="checkbox"
            checked={formData.auto_approve}
            onChange={e => setFormData({ ...formData, auto_approve: e.target.checked })}
            style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
        </div>

        {/* Instructions */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Instructions for Students
          </label>
          <textarea
            rows={3}
            value={formData.instructions}
            onChange={e => setFormData({ ...formData, instructions: e.target.value })}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Quick Text Import */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Quick Bulk Import Questions (Optional)
            </label>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Supports MCQ, Blanks, and Odd-One-Out
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Paste questions text (e.g. from quiz.txt with Q1., A), B), C), D) and Answer - ...). You can also add questions manually in the next step.
          </p>
          <textarea
            rows={5}
            value={formData.raw_questions}
            onChange={e => setFormData({ ...formData, raw_questions: e.target.value })}
            placeholder={`Q1. Which device displays computer graphics visually?\nA) Scanner\nB) Keyboard\nC) Monitor\nD) Mouse\nAnswer - C) Monitor`}
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: 'Söhne Mono, monospace',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={() => router.push('/admin/quizzes')}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 28px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 2px 6px rgba(204, 120, 92, 0.25)',
            }}
          >
            {loading ? 'Creating Quiz...' : 'Create & Proceed to Questions →'}
          </button>
        </div>
      </form>
    </div>
  );
}
