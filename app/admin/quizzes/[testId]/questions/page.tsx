'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { parseQuizText, ParsedQuestion } from '@/lib/quizParser';

export default function ManageQuizQuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;

  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add question modal/panel
  const [showAddModal, setShowAddModal] = useState(false);
  const [qType, setQType] = useState<'MCQ' | 'FILL_BLANK' | 'ODD_ONE_OUT'>('MCQ');
  const [questionText, setQuestionText] = useState('');
  const [mcqOptions, setMcqOptions] = useState<string[]>(['', '', '', '']);
  const [correctOptionIdx, setCorrectOptionIdx] = useState<number>(0);
  const [fillAnswer, setFillAnswer] = useState('');
  const [altAnswers, setAltAnswers] = useState('');
  const [oddOptions, setOddOptions] = useState<string[]>(['', '', '', '']);
  const [oddSelectedIdx, setOddSelectedIdx] = useState<number>(0);
  const [explanation, setExplanation] = useState('');
  const [marks, setMarks] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Bulk import modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<ParsedQuestion[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/admin/quizzes/${testId}/questions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const d = await res.json();
        setTest(d.test);
        setQuestions(d.questions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [testId]);

  useEffect(() => {
    if (rawText.trim()) {
      setParsedPreview(parseQuizText(rawText));
    } else {
      setParsedPreview([]);
    }
  }, [rawText]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      alert('Please enter a question');
      return;
    }

    let payload: any = {
      action: 'add_question',
      type: qType,
      question_text: questionText.trim(),
      explanation: explanation.trim() || undefined,
      marks: marks || 1,
    };

    if (qType === 'MCQ') {
      const validOptions = mcqOptions.map(o => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        alert('Please provide at least 2 options for an MCQ');
        return;
      }
      payload.options = validOptions;
      payload.correct_answer = validOptions[correctOptionIdx] || validOptions[0];
    } else if (qType === 'FILL_BLANK') {
      if (!fillAnswer.trim()) {
        alert('Please provide the defined correct answer');
        return;
      }
      payload.correct_answer = fillAnswer.trim();
      payload.alternate_answers = altAnswers
        ? altAnswers.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      payload.options = [];
    } else if (qType === 'ODD_ONE_OUT') {
      const validOptions = oddOptions.map(o => o.trim()).filter(Boolean);
      if (validOptions.length < 3) {
        alert('Please provide at least 3 items for Odd One Out');
        return;
      }
      payload.options = validOptions;
      payload.correct_answer = validOptions[oddSelectedIdx] || validOptions[0];
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to add question');
      }
    } catch {
      alert('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setQuestionText('');
    setMcqOptions(['', '', '', '']);
    setCorrectOptionIdx(0);
    setFillAnswer('');
    setAltAnswers('');
    setOddOptions(['', '', '', '']);
    setOddSelectedIdx(0);
    setExplanation('');
    setMarks(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/admin/quizzes/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'delete_question', id }),
      });
      if (res.ok) fetchData();
    } catch {
      alert('Failed to delete question');
    }
  };

  const handleBulkImport = async () => {
    if (parsedPreview.length === 0) {
      alert('No valid questions parsed from text.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/quizzes/${testId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          action: 'bulk_import',
          parsed_questions: parsedPreview,
          replace_existing: replaceExisting,
        }),
      });
      if (res.ok) {
        setShowBulkModal(false);
        setRawText('');
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || 'Bulk import failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading Questions...</div>;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://code.zealindori.com';
  const customUrl = `${origin}/${test?.unique_id}`;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/admin/quizzes" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Quizzes</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)' }}>{test?.title || 'Quiz Questions'}</span>
      </div>

      {/* Top Banner */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {test?.title}
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              {questions.length} Questions
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Live Link: <a href={customUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontFamily: 'Söhne Mono, monospace' }}>{customUrl}</a>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowBulkModal(true)}
            style={{
              padding: '10px 16px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📋 Bulk Paste / Import
          </button>

          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            style={{
              padding: '10px 18px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            + Add Question
          </button>
        </div>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <div style={{ background: 'var(--surface-1)', border: '1px dashed var(--border)', borderRadius: '8px', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>❓</div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Questions Added Yet
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Add questions one by one or paste questions text to populate the quiz instantly.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => setShowBulkModal(true)}
              style={{ padding: '10px 18px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              Bulk Paste Text
            </button>
            <button
              onClick={() => { resetForm(); setShowAddModal(true); }}
              style={{ padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}
            >
              + Add Question
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {questions.map((q, idx) => (
            <div
              key={q.id}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'Söhne Mono, monospace' }}>
                    Q{idx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: q.type === 'MCQ' ? 'rgba(93, 184, 114, 0.15)' : q.type === 'ODD_ONE_OUT' ? 'rgba(232, 165, 90, 0.15)' : 'rgba(204, 120, 92, 0.15)',
                      color: q.type === 'MCQ' ? 'var(--success)' : q.type === 'ODD_ONE_OUT' ? 'var(--warning)' : 'var(--accent)',
                    }}
                  >
                    {q.type === 'MCQ' ? 'Multiple Choice' : q.type === 'ODD_ONE_OUT' ? 'Odd One Out' : 'Fill in Blank'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {q.marks} Mark{q.marks > 1 ? 's' : ''}
                  </span>
                </div>

                <button
                  onClick={() => handleDelete(q.id)}
                  style={{
                    fontSize: '12px',
                    color: 'var(--error)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                >
                  Delete
                </button>
              </div>

              {/* Question Text */}
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', lineHeight: 1.4 }}>
                {q.question_text}
              </p>

              {/* Options */}
              {q.options && q.options.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                  {q.options.map((opt: string, optIdx: number) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isDefinedAnswer = opt.toLowerCase() === q.correct_answer.toLowerCase();

                    return (
                      <div
                        key={optIdx}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: isDefinedAnswer ? 'var(--success-dim)' : 'var(--surface-2)',
                          border: `1px solid ${isDefinedAnswer ? 'var(--success)' : 'var(--border)'}`,
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: isDefinedAnswer ? 'var(--success)' : 'var(--text-muted)' }}>
                          {letter})
                        </span>
                        <span>{opt}</span>
                        {isDefinedAnswer && (
                          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>
                            ✓ Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Defined Answer banner for Blanks */}
              {q.type === 'FILL_BLANK' && (
                <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '6px', marginBottom: '8px', fontSize: '13px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Defined Answer: </strong>
                  <span style={{ color: 'var(--success)', fontWeight: 600, fontFamily: 'Söhne Mono, monospace' }}>{q.correct_answer}</span>
                  {q.alternate_answers && q.alternate_answers.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                      (Alternates: {q.alternate_answers.join(', ')})
                    </span>
                  )}
                </div>
              )}

              {/* Odd One Out banner */}
              {q.type === 'ODD_ONE_OUT' && (
                <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '6px', marginBottom: '8px', fontSize: '13px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Defined Odd Item: </strong>
                  <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{q.correct_answer}</span>
                </div>
              )}

              {q.explanation && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '6px' }}>
                  💡 {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ADD QUESTION MODAL */}
      {showAddModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Add Quiz Question
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Type selector tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--surface-2)', padding: '4px', borderRadius: '8px' }}>
              {(['MCQ', 'FILL_BLANK', 'ODD_ONE_OUT'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQType(t)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: qType === t ? 'var(--accent)' : 'transparent',
                    color: qType === t ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t === 'MCQ' ? 'Multiple Choice' : t === 'FILL_BLANK' ? 'Fill in the Blank' : 'Odd One Out'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Question Statement */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Question Statement *
                </label>
                <textarea
                  rows={3}
                  required
                  value={questionText}
                  onChange={e => setQuestionText(e.target.value)}
                  placeholder={qType === 'FILL_BLANK' ? 'e.g. The ratio of width to height is called _____.' : 'e.g. Which of the following is the smallest addressable element?'}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* MCQ Options */}
              {qType === 'MCQ' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Options & Correct Answer Selection *
                  </label>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Click the radio button next to the option that is the correct answer.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {mcqOptions.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="radio"
                            name="correct_opt"
                            checked={correctOptionIdx === idx}
                            onChange={() => setCorrectOptionIdx(idx)}
                            style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--success)' }}
                            title="Set as correct answer"
                          />
                          <span style={{ fontSize: '14px', fontWeight: 700, width: '20px', color: correctOptionIdx === idx ? 'var(--success)' : 'var(--text-muted)' }}>
                            {letter})
                          </span>
                          <input
                            type="text"
                            required
                            value={opt}
                            onChange={e => {
                              const copy = [...mcqOptions];
                              copy[idx] = e.target.value;
                              setMcqOptions(copy);
                            }}
                            placeholder={`Option ${letter}`}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              background: 'var(--surface-2)',
                              border: `1px solid ${correctOptionIdx === idx ? 'var(--success)' : 'var(--border)'}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              color: 'var(--text-primary)',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fill in Blank Answers */}
              {qType === 'FILL_BLANK' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Defined Correct Answer *
                  </label>
                  <input
                    type="text"
                    required
                    value={fillAnswer}
                    onChange={e => setFillAnswer(e.target.value)}
                    placeholder="e.g. Pixel (case-insensitive)"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      marginBottom: '10px',
                    }}
                  />
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Alternate acceptable answers (comma-separated, optional)
                  </label>
                  <input
                    type="text"
                    value={altAnswers}
                    onChange={e => setAltAnswers(e.target.value)}
                    placeholder="e.g. Picture element, pel"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              )}

              {/* Odd One Out Options */}
              {qType === 'ODD_ONE_OUT' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Items / Options & Select the Odd One *
                  </label>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Click the radio button next to the item that is the Odd One Out.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {oddOptions.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="radio"
                          name="odd_opt"
                          checked={oddSelectedIdx === idx}
                          onChange={() => setOddSelectedIdx(idx)}
                          style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--warning)' }}
                          title="Set as odd one out"
                        />
                        <span style={{ fontSize: '14px', fontWeight: 600, width: '20px', color: oddSelectedIdx === idx ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          required
                          value={opt}
                          onChange={e => {
                            const copy = [...oddOptions];
                            copy[idx] = e.target.value;
                            setOddOptions(copy);
                          }}
                          placeholder={`Item ${idx + 1} (e.g. Scanner)`}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            background: 'var(--surface-2)',
                            border: `1px solid ${oddSelectedIdx === idx ? 'var(--warning)' : 'var(--border)'}`,
                            borderRadius: '6px',
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation & Marks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Explanation (Optional)
                  </label>
                  <input
                    type="text"
                    value={explanation}
                    onChange={e => setExplanation(e.target.value)}
                    placeholder="Shown in results after submission"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    Marks
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={marks}
                    onChange={e => setMarks(parseFloat(e.target.value) || 1)}
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
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '10px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 22px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Adding...' : 'Save Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {showBulkModal && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Bulk Import Questions from Text
              </h2>
              <button
                onClick={() => setShowBulkModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Paste questions formatted like standard quizzes or text files (e.g. Q1. ... A) ... B) ... Answer - ...).
            </p>

            <textarea
              rows={8}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`Q1. Which device displays computer graphics visually?\nA) Scanner\nB) Keyboard\nC) Monitor\nD) Mouse\nAnswer - C) Monitor\n\nQ2. The ratio of width to height is called:\nA) Resolution\nB) Pixel\nC) Aspect ratio\nD) Frame buffer\nAnswer - C) Aspect ratio`}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: 'Söhne Mono, monospace',
                color: 'var(--text-primary)',
                marginBottom: '16px',
              }}
            />

            {/* Live Parsing Preview */}
            {parsedPreview.length > 0 && (
              <div style={{ marginBottom: '16px', padding: '14px', background: 'var(--surface-2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)', marginBottom: '8px' }}>
                  ✓ Successfully recognized {parsedPreview.length} questions!
                </p>
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {parsedPreview.map((pq, pidx) => (
                    <div key={pidx} style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                      <strong>Q{pidx + 1}:</strong> {pq.question_text.substring(0, 60)}...
                      <span style={{ color: 'var(--success)', marginLeft: '8px', fontWeight: 600 }}>Ans: {pq.correct_answer}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <input
                type="checkbox"
                id="replace_ext"
                checked={replaceExisting}
                onChange={e => setReplaceExisting(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <label htmlFor="replace_ext" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Replace existing questions in this quiz
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={submitting || parsedPreview.length === 0}
                style={{
                  padding: '10px 22px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#fff',
                  cursor: submitting || parsedPreview.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: submitting || parsedPreview.length === 0 ? 0.6 : 1,
                }}
              >
                {submitting ? 'Importing...' : `Import ${parsedPreview.length} Questions`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
