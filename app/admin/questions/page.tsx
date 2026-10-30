'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Plus, Trash2, Edit2, UploadCloud, Rocket, Check, ExternalLink, Code2, BookOpen, Layers } from 'lucide-react';

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  category?: string;
  total_marks?: number;
  duration_minutes?: number;
  subject_code?: string;
  _count?: { quizQuestions: number };
}

interface QuizQuestion {
  id: string;
  bank_id?: string;
  bank_name?: string;
  order_index: number;
  type: string;
  question_text: string;
  code_snippet?: string;
  options: string[];
  correct_answer: string;
  alternate_answers: string[];
  explanation?: string;
  marks: number;
}

interface CodingQuestion {
  id: string;
  title: string;
  topic: string;
  description: string;
  input_format: string;
  output_format: string;
  constraints: string;
  sample_input: string;
  sample_output: string;
  marks: number;
  difficulty: string;
  testCases: Array<{
    id: string;
    input: string;
    expected_output: string;
    is_hidden: boolean;
    marks: number;
  }>;
}

export default function QuestionsPage() {
  const [tab, setTab] = useState<'QUIZ' | 'CODING'>('QUIZ');
  const [loading, setLoading] = useState(true);

  // Quiz Banks & Questions
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  // Coding Questions
  const [codingQuestions, setCodingQuestions] = useState<CodingQuestion[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // Modals
  const [showNewBankModal, setShowNewBankModal] = useState(false);
  const [newBankData, setNewBankData] = useState({
    name: '',
    description: '',
    category: 'PUZZLE',
    total_marks: 30,
    duration_minutes: 30,
    subject_code: 'DSA',
  });

  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [questionFormData, setQuestionFormData] = useState({
    question_text: '',
    code_snippet: '',
    type: 'SHORT_ANSWER',
    optionsText: '',
    correct_answer: '',
    alternatesText: '',
    explanation: '',
    marks: 2,
  });

  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkTargetBankId, setBulkTargetBankId] = useState('');

  // Create Test Modal state
  const [showCreateTestModal, setShowCreateTestModal] = useState(false);
  const [createTestConfig, setCreateTestConfig] = useState({
    title: '',
    test_type: 'PUZZLE',
    target_division: '',
    duration_minutes: 30,
    auto_approve: false,
  });

  // Test creation status
  const [createdTestSlug, setCreatedTestSlug] = useState<string | null>(null);

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : '';

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/questions', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setBanks(data.questionBanks || []);
      setQuizQuestions(data.quizQuestions || []);
      setCodingQuestions(data.questions || []);
      setSubjects(data.subjects || []);

      if (data.questionBanks?.length > 0 && !selectedBankId) {
        setSelectedBankId(data.questionBanks[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered quiz questions for the selected bank
  const currentBank = banks.find(b => b.id === selectedBankId);
  const currentBankQuestions = quizQuestions.filter(q => q.bank_id === selectedBankId);

  // ── Bank Handlers ──────────────────────────────────────────────────────────
  const handleCreateBank = async () => {
    if (!newBankData.name.trim()) return alert('Bank name is required');
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'create_bank', ...newBankData }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowNewBankModal(false);
        setNewBankData({ name: '', description: '', category: '', total_marks: 30, duration_minutes: 30, subject_code: 'DSA' });
        await fetchData();
        if (data.bank) setSelectedBankId(data.bank.id);
      } else {
        alert(data.error || 'Failed to create bank');
      }
    } catch {
      alert('Error creating question bank');
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!confirm('Are you sure you want to delete this question bank and all its questions?')) return;
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'delete_bank', bank_id: bankId }),
    });
    fetchData();
  };

  // ── Question Handlers ──────────────────────────────────────────────────────
  const handleSaveQuestion = async () => {
    if (!questionFormData.question_text.trim()) return alert('Question text is required');

    const options = questionFormData.optionsText
      .split('\n')
      .map(o => o.trim())
      .filter(Boolean);

    const alternate_answers = questionFormData.alternatesText
      .split('\n')
      .map(a => a.trim())
      .filter(Boolean);

    const payload = {
      action: editingQuestion ? 'update_quiz_question' : 'create_quiz_question',
      id: editingQuestion?.id,
      bank_id: selectedBankId,
      bank_name: currentBank?.name,
      question_text: questionFormData.question_text,
      code_snippet: questionFormData.code_snippet,
      type: questionFormData.type,
      options,
      correct_answer: questionFormData.correct_answer,
      alternate_answers,
      explanation: questionFormData.explanation,
      marks: questionFormData.marks,
    };

    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setShowAddQuestionModal(false);
      setEditingQuestion(null);
      setQuestionFormData({ question_text: '', code_snippet: '', type: 'SHORT_ANSWER', optionsText: '', correct_answer: '', alternatesText: '', explanation: '', marks: 2 });
      fetchData();
    } else {
      const d = await res.json();
      alert(d.error || 'Failed to save question');
    }
  };

  const handleDeleteQuizQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'delete_quiz_question', id }),
    });
    fetchData();
  };

  // ── Bulk Import ────────────────────────────────────────────────────────────
  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) return alert('Please paste question content to import');
    const targetId = bulkTargetBankId || selectedBankId;
    if (!targetId) return alert('Please select a question bank');

    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'bulk_import_bank', bank_id: targetId, text: bulkImportText }),
    });

    const data = await res.json();
    if (res.ok) {
      alert(`Successfully imported ${data.count} questions!`);
      setShowBulkImportModal(false);
      setBulkImportText('');
      fetchData();
    } else {
      alert(data.error || 'Bulk import failed');
    }
  };

  // ── Create Test From Bank ──────────────────────────────────────────────────
  const handleOpenCreateTestModal = () => {
    if (!currentBank) return;
    const isPuzzle = (currentBank.category || '').toUpperCase() === 'PUZZLE' || currentBank.name.toLowerCase().includes('puzzle');
    setCreateTestConfig({
      title: currentBank.name,
      test_type: isPuzzle ? 'PUZZLE' : 'QUIZ',
      target_division: '',
      duration_minutes: currentBank.duration_minutes || (isPuzzle ? 30 : 20),
      auto_approve: false,
    });
    setShowCreateTestModal(true);
  };

  const handleConfirmCreateTest = async () => {
    if (!selectedBankId) return;
    const res = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ 
        action: 'create_test_from_bank', 
        bank_id: selectedBankId,
        ...createTestConfig 
      }),
    });
    const data = await res.json();
    if (res.ok && data.test) {
      setShowCreateTestModal(false);
      setCreatedTestSlug(data.test.unique_id);
      alert(`Test published successfully! Student test link: /${data.test.unique_id}`);
    } else {
      alert(data.error || 'Failed to create test');
    }
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading Question Bank...</div>;

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '6px' }}>Curriculum Repository</p>
          <h1 style={{ fontSize: '26px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Question Bank
          </h1>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px' }}>
          <button
            onClick={() => setTab('QUIZ')}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              background: tab === 'QUIZ' ? 'var(--accent)' : 'transparent',
              color: tab === 'QUIZ' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BookOpen size={14} /> Puzzle & Quiz Banks ({banks.length})
          </button>
          <button
            onClick={() => setTab('CODING')}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              background: tab === 'CODING' ? 'var(--accent)' : 'transparent',
              color: tab === 'CODING' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Code2 size={14} /> Coding Question Bank ({codingQuestions.length})
          </button>
        </div>
      </div>

      {/* ── TAB 1: PUZZLE & QUIZ QUESTION BANKS ──────────────────────────────── */}
      {tab === 'QUIZ' && (
        <div>
          {/* Controls toolbar */}
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            {/* Bank Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Select Bank:
              </span>
              <select
                value={selectedBankId}
                onChange={e => setSelectedBankId(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minWidth: '280px',
                }}
              >
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b._count?.quizQuestions || 0} Qs)
                  </option>
                ))}
              </select>

              {currentBank && (
                <button
                  onClick={() => handleDeleteBank(currentBank.id)}
                  title="Delete this Question Bank"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setShowNewBankModal(true)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={14} /> New Bank
              </button>

              <button
                onClick={() => {
                  setBulkTargetBankId(selectedBankId);
                  setShowBulkImportModal(true);
                }}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <UploadCloud size={14} /> Bulk Import
              </button>

              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setQuestionFormData({ question_text: '', code_snippet: '', type: 'SHORT_ANSWER', optionsText: '', correct_answer: '', alternatesText: '', explanation: '', marks: 2 });
                  setShowAddQuestionModal(true);
                }}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={14} /> Add Question
              </button>

              <button
                onClick={handleOpenCreateTestModal}
                style={{
                  background: '#22c55e',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Rocket size={14} /> Create Test
              </button>
            </div>
          </div>

          {/* Active Bank Header Details */}
          {currentBank && (
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '20px 24px',
              marginBottom: '28px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {currentBank.name}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {currentBank.description || 'Question Bank repository for assessments'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {currentBank.name.includes('Unit III') && (
                    <a
                      href="/unit-3-linked-lists"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#3b82f6',
                        fontSize: '12px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ExternalLink size={13} /> Open Live Test (/unit-3-linked-lists)
                    </a>
                  )}

                  {currentBank.name.includes('Unit IV') && (
                    <a
                      href="/unit-4-stacks"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#3b82f6',
                        fontSize: '12px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ExternalLink size={13} /> Open Live Test (/unit-4-stacks)
                    </a>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <span>Total Questions: <strong style={{ color: 'var(--text-primary)' }}>{currentBankQuestions.length}</strong></span>
                <span>Total Marks: <strong style={{ color: 'var(--text-primary)' }}>{currentBankQuestions.reduce((s, q) => s + q.marks, 0) || currentBank.total_marks || 30}</strong></span>
                <span>Default Duration: <strong style={{ color: 'var(--text-primary)' }}>{currentBank.duration_minutes || 30} mins</strong></span>
                <span>Category: <strong style={{ color: 'var(--text-primary)' }}>{currentBank.category || 'General'}</strong></span>
              </div>
            </div>
          )}

          {/* Questions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {currentBankQuestions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px',
                background: 'var(--surface-1)',
                border: '1px dashed var(--border)',
                borderRadius: '6px',
              }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                  No questions in this bank yet.
                </p>
                <button
                  onClick={() => {
                    setEditingQuestion(null);
                    setShowAddQuestionModal(true);
                  }}
                  style={{
                    background: 'var(--accent)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 18px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Add First Question
                </button>
              </div>
            ) : (
              currentBankQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        fontFamily: 'Söhne Mono, ui-monospace, monospace',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--accent)',
                      }}>
                        Q{idx + 1}.
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#3b82f6',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                      }}>
                        {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        {q.type}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setEditingQuestion(q);
                          setQuestionFormData({
                            question_text: q.question_text,
                            code_snippet: q.code_snippet || '',
                            type: q.type,
                            optionsText: (q.options || []).join('\n'),
                            correct_answer: q.correct_answer,
                            alternatesText: (q.alternate_answers || []).join('\n'),
                            explanation: q.explanation || '',
                            marks: q.marks,
                          });
                          setShowAddQuestionModal(true);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                        }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteQuizQuestion(q.id)}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <p style={{ fontSize: '14.5px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: '12px' }}>
                    {q.question_text}
                  </p>

                  {/* Code snippet / Diagram */}
                  {q.code_snippet && (
                    <div style={{
                      background: '#0d1117',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      padding: '12px 16px',
                      marginBottom: '14px',
                      overflowX: 'auto',
                    }}>
                      <pre style={{ margin: 0, fontFamily: 'Fira Code, Söhne Mono, monospace', fontSize: '13px', color: '#58a6ff' }}>
                        {q.code_snippet}
                      </pre>
                    </div>
                  )}

                  {/* Options if MCQ */}
                  {q.options && q.options.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                      {q.options.map((opt, i) => (
                        <div key={i} style={{
                          padding: '8px 12px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                        }}>
                          <strong style={{ color: 'var(--text-primary)', marginRight: '6px' }}>{String.fromCharCode(65 + i)}.</strong>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Answer & Explanation */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '4px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    fontSize: '13px',
                  }}>
                    <p style={{ margin: 0, color: '#22c55e', fontWeight: 600 }}>
                      Correct Answer: <span style={{ color: 'var(--text-primary)', fontFamily: 'Söhne Mono, monospace' }}>{q.correct_answer}</span>
                    </p>
                    {q.alternate_answers && q.alternate_answers.length > 0 && (
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Accepted variations: {q.alternate_answers.join(' | ')}
                      </p>
                    )}
                    {q.explanation && (
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(34, 197, 94, 0.2)', paddingTop: '6px' }}>
                        💡 {q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: CODING QUESTIONS BANK (Existing) ─────────────────────────── */}
      {tab === 'CODING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Coding Questions Bank ({codingQuestions.length})
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Programs with automated testcase execution via Judge0
              </p>
            </div>
          </div>

          {codingQuestions.map((q, idx) => (
            <div key={q.id} style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {idx + 1}. {q.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Topic: {q.topic || 'DSA'} · Difficulty: {q.difficulty} · Marks: {q.marks} · {q.testCases?.length || 0} Testcases
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                    {q.description.substring(0, 180)}...
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: CREATE QUESTION BANK ─────────────────────────────────────── */}
      {showNewBankModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ maxWidth: '480px', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Create New Question Bank</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bank Name *</label>
                <input
                  value={newBankData.name}
                  onChange={e => setNewBankData(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Unit V – Trees & Binary Search Trees"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
                <input
                  value={newBankData.description}
                  onChange={e => setNewBankData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of topics covered"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bank Mode / Category</label>
                  <select
                    value={newBankData.category}
                    onChange={e => setNewBankData(p => ({ ...p, category: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="PUZZLE">🧩 Puzzle Test (Pointers & Diagrams)</option>
                    <option value="QUIZ">📝 Quiz Test (Theory, Stacks & Recursion)</option>
                    <option value="CODING">💻 Coding Questions Bank</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Duration (Mins)</label>
                  <input
                    type="number"
                    value={newBankData.duration_minutes}
                    onChange={e => setNewBankData(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 30 }))}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowNewBankModal(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleCreateBank} style={primaryBtn}>Create Bank</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT QUESTION ──────────────────────────────────────── */}
      {showAddQuestionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              {editingQuestion ? 'Edit Question Configuration' : 'Add Question Configuration'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Question Text *</label>
                <textarea
                  rows={3}
                  value={questionFormData.question_text}
                  onChange={e => setQuestionFormData(p => ({ ...p, question_text: e.target.value }))}
                  placeholder="Enter the complete question..."
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Code Snippet / Diagram (Optional)</label>
                <textarea
                  rows={3}
                  value={questionFormData.code_snippet}
                  onChange={e => setQuestionFormData(p => ({ ...p, code_snippet: e.target.value }))}
                  placeholder="e.g. 10 -> 20 -> 30 -> NULL or C++ code block"
                  style={{ ...inputStyle, fontFamily: 'Fira Code, monospace', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Question Type (Quiz / Puzzle)</label>
                  <select
                    value={questionFormData.type}
                    onChange={e => setQuestionFormData(p => ({ ...p, type: e.target.value }))}
                    style={inputStyle}
                  >
                    <optgroup label="Quiz Question Types">
                      <option value="SHORT_ANSWER">📝 Short Answer / Conceptual Definition</option>
                      <option value="MCQ">🔘 Multiple Choice (MCQ)</option>
                      <option value="TRUE_FALSE">⚖️ True / False</option>
                      <option value="FILL_BLANK">✍️ Fill in the Blank</option>
                    </optgroup>
                    <optgroup label="Puzzle Question Types">
                      <option value="POINTER_PUZZLE">🧩 Linked List Pointer / Node Puzzle</option>
                      <option value="OUTPUT_TRACING">🔍 Output Tracing & Recursion</option>
                      <option value="MISSING_LINK">🔗 Missing Statement / Link Completion</option>
                      <option value="ERROR_FIND">🐞 Identify Error / Bug in Code</option>
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Marks</label>
                  <input
                    type="number"
                    step="0.5"
                    value={questionFormData.marks}
                    onChange={e => setQuestionFormData(p => ({ ...p, marks: parseFloat(e.target.value) || 1 }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              {questionFormData.type === 'MCQ' && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Options (One per line)</label>
                  <textarea
                    rows={4}
                    value={questionFormData.optionsText}
                    onChange={e => setQuestionFormData(p => ({ ...p, optionsText: e.target.value }))}
                    placeholder="Option A\nOption B\nOption C\nOption D"
                    style={inputStyle}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Correct Answer *</label>
                <input
                  value={questionFormData.correct_answer}
                  onChange={e => setQuestionFormData(p => ({ ...p, correct_answer: e.target.value }))}
                  placeholder="Expected answer (e.g. 10, or temp->next = n1;)"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Alternate Acceptable Answers (One per line)</label>
                <textarea
                  rows={2}
                  value={questionFormData.alternatesText}
                  onChange={e => setQuestionFormData(p => ({ ...p, alternatesText: e.target.value }))}
                  placeholder="Variations, e.g. '10', 'node 10', 'Node 10'"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Explanation / Solution Notes</label>
                <input
                  value={questionFormData.explanation}
                  onChange={e => setQuestionFormData(p => ({ ...p, explanation: e.target.value }))}
                  placeholder="Detailed explanation shown to students when marks are published"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowAddQuestionModal(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleSaveQuestion} style={primaryBtn}>{editingQuestion ? 'Update Question' : 'Add Question'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK IMPORT QUESTIONS ────────────────────────────────────── */}
      {showBulkImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Bulk Import Questions</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Paste questions below. The parser automatically detects question numbers, options, answers, and marks!
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target Question Bank</label>
              <select
                value={bulkTargetBankId}
                onChange={e => setBulkTargetBankId(e.target.value)}
                style={inputStyle}
              >
                {banks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Questions Content</label>
              <textarea
                rows={12}
                value={bulkImportText}
                onChange={e => setBulkImportText(e.target.value)}
                placeholder={`Example formats supported:\n\nQ1. Which principle does a stack follow?\nAnswer: LIFO\nMarks: 1\n\nQ2. Sample MCQ\nA) Option 1\nB) Option 2\nAnswer: B`}
                style={{ ...inputStyle, fontFamily: 'Fira Code, monospace', fontSize: '12.5px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowBulkImportModal(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleBulkImport} style={primaryBtn}>Parse & Import</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE TEST FROM BANK ────────────────────────────────────── */}
      {showCreateTestModal && currentBank && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ maxWidth: '520px', width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Publish Test from Question Bank</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Configure test mode and target division before publishing.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Test Title *</label>
                <input
                  value={createTestConfig.title}
                  onChange={e => setCreateTestConfig(p => ({ ...p, title: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Test Mode</label>
                  <select
                    value={createTestConfig.test_type}
                    onChange={e => setCreateTestConfig(p => ({ ...p, test_type: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="PUZZLE">🧩 Puzzle Test (Pointers & Diagrams)</option>
                    <option value="QUIZ">📝 Quiz Test (Theory & Concept)</option>
                    <option value="CODING">💻 Coding Test</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Duration (Mins)</label>
                  <input
                    type="number"
                    value={createTestConfig.duration_minutes}
                    onChange={e => setCreateTestConfig(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 30 }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target Division Section</label>
                <select
                  value={createTestConfig.target_division}
                  onChange={e => setCreateTestConfig(p => ({ ...p, target_division: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">All Divisions (Both AIDS A & AIDS B)</option>
                  <option value="AIDS A">AIDS A (AD13 Series)</option>
                  <option value="AIDS B">AIDS B (AD14 Series)</option>
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Restricts student access according to Division A (AD13) or Division B (AD14).
                </p>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  ⚠️ Anti-Cheat & Alt-Tab Limit:
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Strict 3-strike alt-tab violation limit with automatic submission on the 3rd strike is active.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowCreateTestModal(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleConfirmCreateTest} style={{ ...primaryBtn, background: '#22c55e' }}>
                <Rocket size={14} style={{ marginRight: '6px' }} /> Publish Live Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
};

const cancelBtn: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: '6px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  padding: '10px 22px',
  borderRadius: '6px',
  background: 'var(--accent)',
  border: 'none',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};
