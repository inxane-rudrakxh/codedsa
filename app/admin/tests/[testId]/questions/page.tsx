'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Check, Lightbulb, BookOpen } from 'lucide-react';

export default function TestQuestionsPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [test, setTest] = useState<any>(null);
  const [assignedQuestions, setAssignedQuestions] = useState<any[]>([]);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [testQuizQuestions, setTestQuizQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [addingTC, setAddingTC] = useState<string | null>(null);
  const [newTC, setNewTC] = useState({ input: '', expected_output: '', is_hidden: true, marks: 1 });

  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [newData, setNewData] = useState({ title: '', topic: '', description: '', constraints: '', sample_input: '', sample_output: '', subject_name: '' });

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchData = async () => {
    // Fetch test detail (for title/status)
    const testsRes = await fetch('/api/admin/tests', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const testsData = await testsRes.json();
    const found = (testsData.tests || []).find((t: any) => t.id === testId);
    setTest(found || null);

    // Fetch all questions + those assigned to this test
    const qRes = await fetch(`/api/admin/questions?test_id=${testId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const qData = await qRes.json();
    setAssignedQuestions(qData.assignedQuestions || []);
    setTestQuizQuestions(qData.testQuizQuestions || []);
    setBankQuestions(qData.questions || []);
    setSubjects(qData.subjects || []);
    if (qData.subjects?.length > 0 && !newData.subject_name) {
      setNewData(p => ({ ...p, subject_name: qData.subjects[0].name }));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [testId]);

  const handleAssign = async (questionId: string) => {
    if (!questionId) return;
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'assign_question', test_id: testId, question_id: questionId }),
    });
    fetchData();
  };

  const handleRemove = async (questionId: string) => {
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'remove_question', test_id: testId, question_id: questionId }),
    });
    fetchData();
  };

  const handleCreate = async () => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'create', ...newData }),
    });
    setIsCreating(false);
    setNewData({ title: '', topic: '', description: '', constraints: '', sample_input: '', sample_output: '', subject_name: subjects[0]?.name || '' });
    fetchData();
  };

  const handleUpdate = async (id: string) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'update', id, ...editData }),
    });
    setEditingId(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'delete', id }),
    });
    fetchData();
  };

  const handleAddTC = async (questionId: string) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'add_test_case', question_id: questionId, ...newTC }),
    });
    setAddingTC(null);
    setNewTC({ input: '', expected_output: '', is_hidden: true, marks: 1 });
    fetchData();
  };

  const handleDeleteTC = async (tcId: string) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'delete_test_case', id: tcId }),
    });
    fetchData();
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: 'generate_ai', prompt: aiPrompt, subject_name: subjects[0]?.name || 'General' }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsGeneratingAI(false);
        setAiPrompt('');
        fetchData();
      } else {
        alert(data.error || 'AI generation failed');
      }
    } catch { alert('An error occurred'); }
    setAiGenerating(false);
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>;

  // Questions assigned to this test, enriched with full question data
  const isQuiz = test?.test_type === 'QUIZ' || test?.test_type === 'PUZZLE';
  const quizQs = testQuizQuestions.length > 0 ? testQuizQuestions : (test?.quizQuestions || []);

  const assignedIds = new Set(assignedQuestions.map((q: any) => q.question_id || q.id));
  const unassigned = bankQuestions.filter((q: any) => !assignedIds.has(q.id));
  // Full question objects for assigned
  const assignedFull = assignedQuestions.map((aq: any) => {
    const full = bankQuestions.find((q: any) => q.id === (aq.question_id || aq.id));
    return full ? { ...full, order_index: aq.order_index } : null;
  }).filter(Boolean);

  if (isQuiz) {
    return (
      <div>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <Link href="/admin/tests" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Tests</Link>
          <span>›</span>
          <Link href={`/admin/tests/${testId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{test?.title || testId}</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)' }}>Questions</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <p className="text-label" style={{ margin: 0 }}>Puzzle / Quiz Test</p>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              }}>NON-CODING</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {test?.title}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {quizQs.length} Questions · Total Marks: {test?.total_marks} · Duration: {test?.duration_minutes} Mins
            </p>
          </div>
          <div>
            <Link
              href="/admin/questions"
              style={{
                ...primaryBtn,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Open Question Bank
            </Link>
          </div>
        </div>

        {/* Questions List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {quizQs.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface-1)', border: '1px dashed var(--border)', borderRadius: '6px' }}>
              <BookOpen size={36} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                No Questions Configured for this Test
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                Configure questions or assign from existing question banks.
              </p>
              <Link href="/admin/questions" style={{ ...primaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={14} /> Open Question Banks & Tests
              </Link>
            </div>
          ) : (
            quizQs.map((q: any, idx: number) => (
              <div
                key={q.id}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontFamily: 'Söhne Mono, monospace', fontSize: '14px', fontWeight: 700, color: 'var(--accent)' }}>
                    Q{idx + 1}.
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                  }}>
                    {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                  </span>
                  <span style={{ fontSize: '11px', background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '4px' }}>
                    {q.type}
                  </span>
                </div>

                <p style={{ fontSize: '14.5px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: '12px' }}>
                  {q.question_text}
                </p>

                {q.code_snippet && (
                  <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', padding: '12px 16px', marginBottom: '14px' }}>
                    <pre style={{ margin: 0, fontFamily: 'Fira Code, monospace', fontSize: '13px', color: '#58a6ff' }}>
                      {q.code_snippet}
                    </pre>
                  </div>
                )}

                <div style={{ padding: '10px 14px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.25)', fontSize: '13px' }}>
                  <p style={{ margin: 0, color: '#22c55e', fontWeight: 600 }}>
                    Correct Answer: <span style={{ color: 'var(--text-primary)', fontFamily: 'Söhne Mono, monospace' }}>{q.correct_answer}</span>
                  </p>
                  {q.explanation && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lightbulb size={13} color="#22c55e" style={{ flexShrink: 0 }} /> {q.explanation}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/admin/tests" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Tests</Link>
        <span>›</span>
        <Link href={`/admin/tests/${testId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{test?.title || testId}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)' }}>Questions</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Test · Questions</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Question Bank
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {assignedFull.length} assigned to this test · {bankQuestions.length} total in bank
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setIsGeneratingAI(true)} style={{ ...outlineBtn, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} /> Generate with AI
          </button>
          <button onClick={() => setIsCreating(true)} style={primaryBtn}>Create New Question</button>
        </div>
      </div>

      {/* AI Generate form */}
      {isGeneratingAI && (
        <div style={{ padding: '20px', background: 'var(--surface-1)', border: '1px dashed var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <p className="text-label" style={{ marginBottom: '12px' }}>Generate Question with AI</p>
          <textarea
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            rows={3}
            placeholder="Describe topic and difficulty..."
            style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical', marginBottom: '12px' }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setIsGeneratingAI(false)} style={outlineBtn}>Cancel</button>
            <button onClick={handleGenerateAI} disabled={aiGenerating} style={primaryBtn}>
              {aiGenerating ? 'Generating...' : 'Generate & Save'}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {isCreating && (
        <div style={{ padding: '20px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <p className="text-label" style={{ marginBottom: '16px' }}>Create New Question</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Title</p>
              <input value={newData.title} onChange={e => setNewData(p => ({ ...p, title: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Topic</p>
              <input value={newData.topic} onChange={e => setNewData(p => ({ ...p, topic: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Subject</p>
              <input value={newData.subject_name} onChange={e => setNewData(p => ({ ...p, subject_name: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Problem Description</p>
              <textarea value={newData.description} onChange={e => setNewData(p => ({ ...p, description: e.target.value }))} rows={4} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Constraints</p>
              <textarea value={newData.constraints} onChange={e => setNewData(p => ({ ...p, constraints: e.target.value }))} rows={2} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setIsCreating(false)} style={outlineBtn}>Cancel</button>
            <button onClick={handleCreate} style={primaryBtn}>Save & Create</button>
          </div>
        </div>
      )}

      {/* Assigned to this test */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p className="text-label">Assigned to This Test ({assignedFull.length})</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select id="qselect-assign" style={{ ...inputStyle, width: '240px', padding: '6px 12px' }} defaultValue="">
              <option value="" disabled>Add from bank...</option>
              {unassigned.map((q: any) => (
                <option key={q.id} value={q.id}>[{q.topic || q.subject?.name}] {q.title}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const sel = document.getElementById('qselect-assign') as HTMLSelectElement;
                if (sel.value) { handleAssign(sel.value); sel.value = ''; }
              }}
              style={outlineBtn}
            >
              Add to Test
            </button>
          </div>
        </div>

        {assignedFull.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0' }}>No questions assigned yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {assignedFull.map((q: any, idx: number) => (
              <QuestionRow
                key={q.id}
                q={q}
                idx={idx}
                expanded={expandedId === q.id}
                editing={editingId === q.id}
                editData={editData}
                addingTC={addingTC === q.id}
                newTC={newTC}
                onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
                onEdit={() => { setEditingId(q.id); setEditData(q); setExpandedId(q.id); }}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={() => handleUpdate(q.id)}
                onDelete={() => handleDelete(q.id)}
                onEditChange={(key: string, val: string) => setEditData((p: any) => ({ ...p, [key]: val }))}
                onStartAddTC={() => { setAddingTC(q.id); setExpandedId(q.id); }}
                onCancelAddTC={() => setAddingTC(null)}
                onSaveTC={() => handleAddTC(q.id)}
                onDeleteTC={handleDeleteTC}
                newTCData={newTC}
                onNewTCChange={(val: any) => setNewTC(p => ({ ...p, ...val }))}
                actionSlot={
                  <button onClick={() => handleRemove(q.id)} style={{ ...smallBtn, color: 'var(--error)' }}>Remove from Test</button>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Full question bank */}
      <div>
        <p className="text-label" style={{ marginBottom: '12px' }}>All Questions in Bank ({bankQuestions.length})</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {bankQuestions.map((q: any, idx: number) => (
            <QuestionRow
              key={q.id}
              q={q}
              idx={idx}
              expanded={expandedId === q.id}
              editing={editingId === q.id}
              editData={editData}
              addingTC={addingTC === q.id}
              newTC={newTC}
              onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
              onEdit={() => { setEditingId(q.id); setEditData(q); setExpandedId(q.id); }}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={() => handleUpdate(q.id)}
              onDelete={() => handleDelete(q.id)}
              onEditChange={(key: string, val: string) => setEditData((p: any) => ({ ...p, [key]: val }))}
              onStartAddTC={() => { setAddingTC(q.id); setExpandedId(q.id); }}
              onCancelAddTC={() => setAddingTC(null)}
              onSaveTC={() => handleAddTC(q.id)}
              onDeleteTC={handleDeleteTC}
              newTCData={newTC}
              onNewTCChange={(val: any) => setNewTC(p => ({ ...p, ...val }))}
              actionSlot={
                assignedIds.has(q.id)
                  ? (
                    <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Check size={11} strokeWidth={2.5} /> ASSIGNED
                    </span>
                  )
                  : <button onClick={() => handleAssign(q.id)} style={smallBtn}>Assign to Test</button>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionRow({ q, idx, expanded, editing, editData, addingTC, newTC, newTCData, onToggle, onEdit, onCancelEdit, onSaveEdit, onDelete, onEditChange, onStartAddTC, onCancelAddTC, onSaveTC, onDeleteTC, onNewTCChange, actionSlot }: any) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
      <div
        style={{ padding: '14px 18px', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <span style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '12px', color: 'var(--text-muted)', minWidth: '24px' }}>
          {String(idx + 1).padStart(2, '0')}
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{q.title}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{q.topic || q.subject?.name} · {q.testCases?.length || 0} test cases</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          {actionSlot}
          <button onClick={onEdit} style={smallBtn}>Edit</button>
          <button onClick={onDelete} style={{ ...smallBtn, color: 'var(--error)' }}>Delete</button>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '18px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
          {editing ? (
            <div>
              <p className="text-label" style={{ marginBottom: '12px' }}>Edit Question</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                {[{ label: 'Title', key: 'title' }, { label: 'Topic', key: 'topic' }].map(({ label, key }) => (
                  <div key={key}>
                    <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
                    <input value={editData[key] || ''} onChange={e => onEditChange(key, e.target.value)} style={inputStyle} />
                  </div>
                ))}
                {[{ label: 'Problem Statement', key: 'description' }, { label: 'Constraints', key: 'constraints' }].map(({ label, key }) => (
                  <div key={key}>
                    <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
                    <textarea value={editData[key] || ''} onChange={e => onEditChange(key, e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onCancelEdit} style={outlineBtn}>Cancel</button>
                <button onClick={onSaveEdit} style={primaryBtn}>Save</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p className="text-label">Test Cases</p>
                <button onClick={onStartAddTC} style={smallBtn}>Add Test Case</button>
              </div>

              {addingTC && (
                <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '3px', marginBottom: '8px', background: 'var(--surface-1)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Input</p>
                      <textarea value={newTCData.input} onChange={e => onNewTCChange({ input: e.target.value })} rows={3} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
                    </div>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Expected Output</p>
                      <textarea value={newTCData.expected_output} onChange={e => onNewTCChange({ expected_output: e.target.value })} rows={3} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '8px' }}>
                    <input type="checkbox" checked={!newTCData.is_hidden} onChange={e => onNewTCChange({ is_hidden: !e.target.checked })} />
                    Visible to student
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={onCancelAddTC} style={outlineBtn}>Cancel</button>
                    <button onClick={onSaveTC} style={primaryBtn}>Add</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(q.testCases || []).map((tc: any, ti: number) => (
                  <div key={tc.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px', background: 'var(--surface-1)', borderRadius: '3px', border: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '11px', color: 'var(--text-muted)', minWidth: '16px' }}>{ti + 1}</span>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <pre style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '11px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{tc.input}</pre>
                      <pre style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '11px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{tc.expected_output}</pre>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: !tc.is_hidden ? 'var(--accent)' : 'var(--text-muted)', background: !tc.is_hidden ? 'var(--accent-dim)' : 'var(--surface-2)', padding: '2px 5px', borderRadius: '2px' }}>
                        {!tc.is_hidden ? 'VISIBLE' : 'HIDDEN'}
                      </span>
                      <button onClick={() => onDeleteTC(tc.id)} style={{ fontSize: '10px', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'var(--surface-1)', border: '1px solid var(--border)',
  borderRadius: '3px', color: 'var(--text-secondary)', fontSize: '13px', outline: 'none',
};
const smallBtn: React.CSSProperties = {
  padding: '5px 10px', background: 'transparent', border: '1px solid var(--border)',
  borderRadius: '3px', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer',
};
const outlineBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px',
  color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, cursor: 'pointer',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--accent)', border: '1px solid transparent', borderRadius: '3px',
  color: '#ffffff', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase' as const, cursor: 'pointer',
};
