'use client';

import { useEffect, useState } from 'react';

interface Question {
  id: number;
  title: string;
  topic: string;
  statement: string;
  input_format: string;
  output_format: string;
  constraints: string;
  example_input: string;
  example_output: string;
  is_enabled: number;
  test_cases: Array<{
    id: number;
    input: string;
    expected_output: string;
    type: string;
    is_visible: number;
    weight: number;
  }>;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Question>>({});
  const [addingTC, setAddingTC] = useState<number | null>(null);
  const [newTC, setNewTC] = useState({ input: '', expected_output: '', type: 'hidden', is_visible: false, weight: 1 });

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchQuestions = async () => {
    const res = await fetch('/api/admin/questions', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setQuestions(data.questions || []);
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, []);

  const handleToggle = async (id: number) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'toggle', id }),
    });
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

  const handleAddTC = async (questionId: number) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'add_test_case', question_id: questionId, ...newTC }),
    });
    setAddingTC(null);
    setNewTC({ input: '', expected_output: '', type: 'hidden', is_visible: false, weight: 1 });
    fetchQuestions();
  };

  const handleDeleteTC = async (tcId: number) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'delete_test_case', id: tcId }),
    });
    fetchQuestions();
  };

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}>Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <p className="text-label" style={{ marginBottom: '8px' }}>Management</p>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Question Bank</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {questions.filter(q => q.is_enabled).length} of {questions.length} questions enabled
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{
            border: '1px solid var(--border)',
            borderRadius: '4px',
            overflow: 'hidden',
            opacity: q.is_enabled ? 1 : 0.6,
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
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                color: 'var(--text-muted)',
                minWidth: '24px',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{q.title}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{q.topic} · {q.test_cases.length} test cases</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.10em',
                  color: q.is_enabled ? 'var(--success)' : 'var(--text-muted)',
                  background: q.is_enabled ? 'var(--success-dim)' : 'var(--surface-2)',
                  padding: '3px 7px',
                  borderRadius: '2px',
                }}>
                  {q.is_enabled ? 'ENABLED' : 'DISABLED'}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); handleToggle(q.id); }}
                  style={smallBtn}
                >
                  {q.is_enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setEditingId(q.id); setEditData(q); setExpandedId(q.id); }}
                  style={smallBtn}
                >
                  Edit
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{expandedId === q.id ? '▲' : '▼'}</span>
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
                        { label: 'Input Format', key: 'input_format' },
                        { label: 'Output Format', key: 'output_format' },
                        { label: 'Constraints', key: 'constraints' },
                        { label: 'Example Input', key: 'example_input' },
                        { label: 'Example Output', key: 'example_output' },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
                          <textarea
                            value={(editData as Record<string, string>)[key] || ''}
                            onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                            rows={3}
                            style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', resize: 'vertical' }}
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
                              <textarea value={newTC.input} onChange={e => setNewTC(p => ({ ...p, input: e.target.value }))} rows={3} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', resize: 'vertical' }} />
                            </div>
                            <div>
                              <p className="text-label" style={{ marginBottom: '4px' }}>Expected Output</p>
                              <textarea value={newTC.expected_output} onChange={e => setNewTC(p => ({ ...p, expected_output: e.target.value }))} rows={3} style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace', resize: 'vertical' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                            <select value={newTC.type} onChange={e => setNewTC(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
                              <option value="visible">Visible</option>
                              <option value="hidden">Hidden</option>
                              <option value="edge">Edge</option>
                            </select>
                            <label style={{ display: 'flex', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input type="checkbox" checked={newTC.is_visible} onChange={e => setNewTC(p => ({ ...p, is_visible: e.target.checked }))} />
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
                        {q.test_cases.map((tc, ti) => (
                          <div key={tc.id} style={{
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                            padding: '10px',
                            background: 'var(--surface-1)',
                            borderRadius: '3px',
                            border: '1px solid var(--border)',
                          }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)', minWidth: '16px' }}>{ti + 1}</span>
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{tc.input}</pre>
                              <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{tc.expected_output}</pre>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                letterSpacing: '0.08em',
                                color: tc.is_visible ? 'var(--accent)' : 'var(--text-muted)',
                                background: tc.is_visible ? 'var(--accent-dim)' : 'var(--surface-2)',
                                padding: '2px 5px',
                                borderRadius: '2px',
                              }}>
                                {tc.type.toUpperCase()}
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
  background: 'var(--text-primary)',
  border: '1px solid transparent',
  borderRadius: '3px',
  color: 'var(--bg)',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
};
