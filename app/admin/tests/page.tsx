'use client';

import { useEffect, useState } from 'react';

export default function TestsPage() {
  const [tests, setTests] = useState<any[]>([]);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>({});
  
  const [isCreating, setIsCreating] = useState(false);
  const [newData, setNewData] = useState({ title: '', subject_id: '', duration_minutes: 60, total_marks: 30, questions_per_student: 3 });

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchData = async () => {
    const res = await fetch('/api/admin/tests', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      const data = await res.json();
      setTests(data.tests || []);
      setAllQuestions(data.allQuestions || []);
      setSubjects(data.subjects || []);
      if (data.subjects && data.subjects.length > 0 && !newData.subject_id) {
        setNewData(prev => ({ ...prev, subject_id: data.subjects[0].id.toString() }));
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'create_test', ...newData }),
    });
    setIsCreating(false);
    setNewData({ title: '', subject_id: subjects[0]?.id.toString() || '', duration_minutes: 60, total_marks: 30, questions_per_student: 3 });
    fetchData();
  };

  const handleUpdate = async (id: number) => {
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'update_test', id, ...editData }),
    });
    setEditingId(null);
    fetchData();
  };

  const handleAssignQuestion = async (testId: number, questionId: string) => {
    if (!questionId) return;
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'assign_question', test_id: testId, question_id: questionId }),
    });
    fetchData();
  };

  const handleRemoveQuestion = async (testId: number, questionId: number) => {
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'remove_question', test_id: testId, question_id: questionId }),
    });
    fetchData();
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Management</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Exam Tests</h1>
        </div>
        <button onClick={() => setIsCreating(true)} style={primaryBtn}>Create New Test</button>
      </div>

      {isCreating && (
        <div style={{ padding: '20px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <p className="text-label" style={{ marginBottom: '16px' }}>Create New Test</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Test Title</p>
              <input value={newData.title} onChange={e => setNewData(p => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="e.g. DSA Unit II" />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Subject</p>
              <select value={newData.subject_id} onChange={e => setNewData(p => ({ ...p, subject_id: e.target.value }))} style={inputStyle}>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Duration (Mins)</p>
              <input type="number" value={newData.duration_minutes} onChange={e => setNewData(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Total Marks</p>
              <input type="number" value={newData.total_marks} onChange={e => setNewData(p => ({ ...p, total_marks: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Questions Assigned per Student</p>
              <input type="number" value={newData.questions_per_student} onChange={e => setNewData(p => ({ ...p, questions_per_student: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setIsCreating(false)} style={outlineBtn}>Cancel</button>
            <button onClick={handleCreate} disabled={!newData.title} style={primaryBtn}>Create</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {tests.map(test => (
          <div key={test.id} style={{ border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface-1)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{test.title}</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{test.subject?.name} · {test.duration_minutes} Mins · {test.total_marks} Marks · {test.questions_per_student} Qs/Student</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', padding: '4px 8px', borderRadius: '3px', background: test.status === 'PUBLISHED' ? 'var(--success-dim)' : 'var(--surface-2)', color: test.status === 'PUBLISHED' ? 'var(--success)' : 'var(--text-muted)' }}>
                    {test.status}
                  </span>
                  <button onClick={() => { setEditingId(test.id); setEditData(test); }} style={outlineBtn}>Edit Settings</button>
                </div>
              </div>

              {editingId === test.id && (
                <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: '4px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Title</p>
                      <input value={editData.title} onChange={e => setEditData((p: any) => ({ ...p, title: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Status</p>
                      <select value={editData.status} onChange={e => setEditData((p: any) => ({ ...p, status: e.target.value }))} style={inputStyle}>
                        <option value="DRAFT">DRAFT</option>
                        <option value="PUBLISHED">PUBLISHED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Duration (Mins)</p>
                      <input type="number" value={editData.duration_minutes} onChange={e => setEditData((p: any) => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                    </div>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Total Marks</p>
                      <input type="number" value={editData.total_marks} onChange={e => setEditData((p: any) => ({ ...p, total_marks: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                    </div>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Qs per Student</p>
                      <input type="number" value={editData.questions_per_student} onChange={e => setEditData((p: any) => ({ ...p, questions_per_student: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setEditingId(null)} style={outlineBtn}>Cancel</button>
                    <button onClick={() => handleUpdate(test.id)} style={primaryBtn}>Save</button>
                  </div>
                </div>
              )}

              {/* Question Bank for this test */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p className="text-label">Test Question Bank ({test.testQuestions.length} Questions)</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select 
                      id={`qselect-${test.id}`}
                      style={{ ...inputStyle, width: '200px', padding: '6px 12px' }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select question to add...</option>
                      {allQuestions.filter(q => !test.testQuestions.find((tq: any) => tq.question_id === q.id)).map(q => (
                        <option key={q.id} value={q.id}>[{q.topic}] {q.title}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => {
                        const sel = document.getElementById(`qselect-${test.id}`) as HTMLSelectElement;
                        handleAssignQuestion(test.id, sel.value);
                        sel.value = '';
                      }} 
                      style={outlineBtn}
                    >Add to Test</button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {test.testQuestions.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No questions added yet.</p>
                  ) : test.testQuestions.map((tq: any, idx: number) => (
                    <div key={tq.question_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{idx + 1}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{tq.question.title}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{tq.question.topic}</span>
                      </div>
                      <button onClick={() => handleRemoveQuestion(test.id, tq.question_id)} style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '12px', cursor: 'pointer' }}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
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
  textTransform: 'uppercase',
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
  textTransform: 'uppercase',
  cursor: 'pointer',
};
