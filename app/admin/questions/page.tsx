'use client';

import { useEffect, useState } from 'react';

interface Question {
  id: number;
  title: string;
  topic: string;
  description: string;
  statement?: string;
  input_format: string;
  output_format: string;
  constraints: string;
  example_input: string;
  example_output: string;
  is_enabled: number;
  testCases: Array<{
    id: string;
    input: string;
    expected_output: string;
    is_hidden: boolean;
    marks: number;
  }>;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Question>>({});
  const [addingTC, setAddingTC] = useState<number | null>(null);
  const [newTC, setNewTC] = useState({ input: '', expected_output: '', is_hidden: true, marks: 1 });
  
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [newData, setNewData] = useState({ title: '', topic: '', description: '', input_format: '', output_format: '', constraints: '', sample_input: '', sample_output: '', subject_name: '' });

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchQuestions = async () => {
    const res = await fetch('/api/admin/questions', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setQuestions(data.questions || []);
    setSubjects(data.subjects || []);
    if (data.subjects && data.subjects.length > 0 && !newData.subject_name) {
      setNewData(prev => ({ ...prev, subject_name: data.subjects[0].name }));
    }
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, []);


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
        fetchQuestions();
      } else {
        alert(data.error || 'Failed to generate question with AI');
      }
    } catch (e) {
      console.error(e);
      alert('An error occurred while calling the AI service');
    }
    setAiGenerating(false);
  };

  const handleCreate = async () => {
    // Process subject_id logic or send subject_name to API (we'll send subject_id)
    // Wait, let's update API to accept subject_name as well!
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'create', ...newData }),
    });
    setIsCreating(false);
    setNewData({ title: '', topic: '', description: '', input_format: '', output_format: '', constraints: '', sample_input: '', sample_output: '', subject_name: subjects[0]?.name || '' });
    fetchQuestions();
  };

  const handleUpdate = async (id: number) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'update', id, ...editData }),
    });
    setEditingId(null);
    fetchQuestions();
  };

  const handleDelete = async (id: number) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'delete', id }),
    });
    fetchQuestions();
  };

  const handleAddTC = async (questionId: number) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'add_test_case', question_id: questionId, ...newTC }),
    });
    setAddingTC(null);
    setNewTC({ input: '', expected_output: '', is_hidden: true, marks: 1 });
    fetchQuestions();
  };

  const handleDeleteTC = async (tcId: string) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'delete_test_case', id: tcId }),
    });
    fetchQuestions();
  };

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Management</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Question Bank</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {questions.length} questions available
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setIsGeneratingAI(true)} style={{ ...outlineBtn, color: 'var(--text-primary)' }}>
            ✦ Generate with AI
          </button>
          <button onClick={() => setIsCreating(true)} style={primaryBtn}>
            Create New Question
          </button>
        </div>
      </div>

      {isGeneratingAI && (
        <div style={{ padding: '24px', background: 'var(--surface-1)', border: '1px dashed var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <p className="text-label" style={{ marginBottom: '16px' }}>Generate Question with AI</p>
          <div style={{ marginBottom: '16px' }}>
            <p className="text-label" style={{ marginBottom: '4px' }}>Topic & Difficulty</p>
            <textarea 
              value={aiPrompt} 
              onChange={e => setAiPrompt(e.target.value)} 
              rows={3} 
              style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} 
              placeholder="e.g. Generate a hard Dynamic Programming question about finding the longest palindromic subsequence..." 
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setIsGeneratingAI(false)} style={outlineBtn}>Cancel</button>
            <button onClick={handleGenerateAI} disabled={aiGenerating} style={primaryBtn}>
              {aiGenerating ? 'Generating...' : 'Generate & Save'}
            </button>
          </div>
        </div>
      )}

      {isCreating && (
        <div style={{ padding: '24px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <p className="text-label" style={{ marginBottom: '16px' }}>Create New Question</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Title</p>
              <input value={newData.title} onChange={e => setNewData(p => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="e.g. Reverse Array" />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Topic</p>
              <input value={newData.topic} onChange={e => setNewData(p => ({ ...p, topic: e.target.value }))} style={inputStyle} placeholder="e.g. Arrays, Strings" />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Subject</p>
              <input value={newData.subject_name} onChange={e => setNewData(p => ({ ...p, subject_name: e.target.value }))} style={inputStyle} placeholder="e.g. Data Structures" />
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Problem Description</p>
              <textarea value={newData.description} onChange={e => setNewData(p => ({ ...p, description: e.target.value }))} rows={4} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              {/* Removed Input/Output fields per request */}
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Constraints</p>
              <textarea value={newData.constraints} onChange={e => setNewData(p => ({ ...p, constraints: e.target.value }))} rows={2} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setIsCreating(false)} style={outlineBtn}>Cancel</button>
            <button onClick={handleCreate} style={primaryBtn}>Save & Create</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{
            border: '1px solid var(--border)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            {/* Question header */}
            <div style={{
              padding: '16px 20px',
              background: 'var(--surface-1)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
            }} onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
              <span style={{
                fontFamily: 'Söhne Mono, ui-monospace, monospace',
                fontSize: '12px',
                color: 'var(--text-muted)',
                minWidth: '24px',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{q.title}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{q.topic} · {q.testCases?.length || 0} test cases</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={e => { e.stopPropagation(); setEditingId(q.id); setEditData(q); setExpandedId(q.id); }}
                  style={smallBtn}
                >
                  Edit
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this question?')) {
                      handleDelete(q.id);
                    }
                  }}
                  style={{ ...smallBtn, color: 'var(--error)' }}
                >
                  Delete
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{expandedId === q.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded content */}
            {expandedId === q.id && (
              <div style={{ padding: '20px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                {editingId === q.id ? (
                  <div>
                    <p className="text-label" style={{ marginBottom: '16px' }}>Edit Question</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                      {[
                        { label: 'Title', key: 'title' },
                        { label: 'Topic', key: 'topic' },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
                          <input
                            value={(editData as Record<string, string>)[key] || ''}
                            onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                            style={inputStyle}
                          />
                        </div>
                      ))}
                      {[
                        { label: 'Problem Statement', key: 'statement' },
                        { label: 'Constraints', key: 'constraints' },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
                          <textarea
                            value={(editData as Record<string, string>)[key] || ''}
                            onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                            rows={3}
                            style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditingId(null)} style={outlineBtn}>Cancel</button>
                      <button onClick={() => handleUpdate(q.id)} style={primaryBtn}>Save Changes</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Test Cases */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <p className="text-label">Test Cases</p>
                        <button onClick={() => setAddingTC(q.id)} style={smallBtn}>Add Test Case</button>
                      </div>

                      {addingTC === q.id && (
                        <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '3px', marginBottom: '8px', background: 'var(--surface-1)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                            <div>
                              <p className="text-label" style={{ marginBottom: '4px' }}>Input</p>
                              <textarea value={newTC.input} onChange={e => setNewTC(p => ({ ...p, input: e.target.value }))} rows={3} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
                            </div>
                            <div>
                              <p className="text-label" style={{ marginBottom: '4px' }}>Expected Output</p>
                              <textarea value={newTC.expected_output} onChange={e => setNewTC(p => ({ ...p, expected_output: e.target.value }))} rows={3} style={{ ...inputStyle, fontFamily: 'Söhne Mono, ui-monospace, monospace', resize: 'vertical' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ display: 'flex', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={!newTC.is_hidden} onChange={e => setNewTC(p => ({ ...p, is_hidden: !e.target.checked }))} />
                              Visible to student
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setAddingTC(null)} style={outlineBtn}>Cancel</button>
                            <button onClick={() => handleAddTC(q.id)} style={primaryBtn}>Add</button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {(q.testCases || []).map((tc, ti) => (
                          <div key={tc.id} style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                            padding: '10px',
                            background: 'var(--surface-1)',
                            borderRadius: '3px',
                            border: '1px solid var(--border)',
                          }}>
                            <span style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '11px', color: 'var(--text-muted)', minWidth: '16px' }}>{ti + 1}</span>
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <pre style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '11px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{tc.input}</pre>
                              <pre style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '11px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{tc.expected_output}</pre>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                color: !tc.is_hidden ? 'var(--accent)' : 'var(--text-muted)',
                                background: !tc.is_hidden ? 'var(--accent-dim)' : 'var(--surface-2)',
                                padding: '2px 5px',
                                borderRadius: '2px',
                              }}>
                                {!tc.is_hidden ? 'VISIBLE' : 'HIDDEN'}
                              </span>
                              <button
                                onClick={() => handleDeleteTC(tc.id)}
                                style={{ fontSize: '10px', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  color: 'var(--text-secondary)',
  fontSize: '13px',
  outline: 'none',
};
const smallBtn: React.CSSProperties = {
  padding: '5px 10px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  color: 'var(--text-muted)',
  fontSize: '11px',
  cursor: 'pointer',
  letterSpacing: '0.02em',
};
const outlineBtn: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  color: 'var(--text-secondary)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--accent)',
  border: '1px solid transparent',
  borderRadius: '3px',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
};
