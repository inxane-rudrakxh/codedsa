'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [testToDelete, setTestToDelete] = useState<string | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newData, setNewData] = useState({ title: '', subject_name: '', duration_minutes: 60, total_marks: 30, questions_per_student: 3, allowed_languages: ['c', 'cpp', 'python', 'java'], target_division: '', instructions: '', start_time: '', end_time: '' });
  
  const SUPPORTED_LANGS = [
    { id: 'c', label: 'C' },
    { id: 'cpp', label: 'C++' },
    { id: 'python', label: 'Python' },
    { id: 'java', label: 'Java' },
  ];

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchData = async () => {
    const res = await fetch('/api/admin/tests', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      const data = await res.json();
      setTests(data.tests || []);
      setSubjects(data.subjects || []);
      setDivisions(data.divisions || []);
      if (data.subjects && data.subjects.length > 0 && !newData.subject_name) {
        setNewData(prev => ({ ...prev, subject_name: data.subjects[0].name }));
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    let payload = { action: 'create_test', ...newData };
    if (payload.start_time) {
      payload.start_time = new Date(payload.start_time).toISOString();
    }
    if (payload.end_time) {
      payload.end_time = new Date(payload.end_time).toISOString();
    }

    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
    setIsCreating(false);
    setNewData({ title: '', subject_name: subjects[0]?.name || '', duration_minutes: 60, total_marks: 30, questions_per_student: 3, allowed_languages: ['c', 'cpp', 'python', 'java'], target_division: '', instructions: '', start_time: '', end_time: '' });
    fetchData();
  };

  const handleUpdate = async (id: string) => {
    let payload = { action: 'update_test', id, ...editData };
    if (payload.start_time) {
      payload.start_time = new Date(payload.start_time).toISOString();
    }
    if (payload.end_time) {
      payload.end_time = new Date(payload.end_time).toISOString();
    }
    
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
    setEditingId(null);
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
        <button 
          onClick={() => router.push('/admin/tests/create')} 
          style={{ 
            background: 'var(--accent)', color: '#fff', border: 'none', 
            padding: '12px 24px', borderRadius: '6px', fontSize: '14px', 
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <span style={{ fontSize: '16px' }}>+</span> CREATE TEST
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {tests.map(test => (
          <div key={test.id} style={{ border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface-1)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h2
                      onClick={() => router.push(`/admin/tests/${test.id}`)}
                      style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}
                    >
                      {test.title}
                    </h2>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: test.test_type === 'QUIZ' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.12)',
                      color: test.test_type === 'QUIZ' ? '#c084fc' : '#3b82f6',
                      border: `1px solid ${test.test_type === 'QUIZ' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                      letterSpacing: '0.04em',
                    }}>
                      {test.test_type === 'QUIZ' ? 'PUZZLE / QUIZ' : 'CODING'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                    {test.subject?.name} · {test.duration_minutes} Mins · {test.total_marks} Marks · {test.test_type === 'QUIZ' ? `${test.quizQuestions?.length || test.questions_per_student} Questions` : `${test.questions_per_student} Qs/Student`} 
                    {test.target_division ? ` · Div: ${test.target_division}` : ''}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', margin: '4px 0 0' }}>
                    {test.test_type === 'QUIZ' ? 'Mode: Non-coding questions & puzzles' : `Languages: ${test.allowed_languages?.join(', ') || 'c, cpp, python, java'}`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {test.status === 'PUBLISHED' && test.unique_id && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/${test.unique_id}`);
                        alert('Test Link Copied to Clipboard!');
                      }}
                      style={{ ...outlineBtn, padding: '4px 8px', fontSize: '10px' }}
                    >
                      Copy Link
                    </button>
                  )}
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
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Target Division</p>
                      <select value={editData.target_division || ''} onChange={e => setEditData((p: any) => ({ ...p, target_division: e.target.value }))} style={inputStyle}>
                        <option value="">All Divisions</option>
                        {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Instructions / Guidelines</p>
                      <textarea value={editData.instructions || ''} onChange={e => setEditData((p: any) => ({ ...p, instructions: e.target.value }))} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
                    </div>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Start Time</p>
                      <input type="datetime-local" value={editData.start_time ? new Date(new Date(editData.start_time).getTime() - new Date(editData.start_time).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} onChange={e => setEditData((p: any) => ({ ...p, start_time: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <p className="text-label" style={{ marginBottom: '4px' }}>End Time</p>
                      <input type="datetime-local" value={editData.end_time ? new Date(new Date(editData.end_time).getTime() - new Date(editData.end_time).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} onChange={e => setEditData((p: any) => ({ ...p, end_time: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <p className="text-label" style={{ marginBottom: '4px' }}>Allowed Languages</p>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        {SUPPORTED_LANGS.map(lang => {
                          const langs = editData.allowed_languages || ['c', 'cpp', 'python', 'java'];
                          return (
                            <label key={lang.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                              <input 
                                type="checkbox" 
                                checked={langs.includes(lang.id)}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  setEditData((p: any) => ({
                                    ...p,
                                    allowed_languages: checked 
                                      ? [...langs, lang.id] 
                                      : langs.filter((l: string) => l !== lang.id)
                                  }));
                                }}
                              />
                              {lang.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button 
                      onClick={() => setTestToDelete(test.id)}
                      style={{ ...outlineBtn, color: 'var(--error)', borderColor: 'var(--error-dim)' }}
                    >
                      Delete Test
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setEditingId(null)} style={outlineBtn}>Cancel</button>
                      <button onClick={() => handleUpdate(test.id)} style={primaryBtn}>Save</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Test quick-links */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {[
                  { label: `Questions (${test.testQuestions.length})`, href: `/admin/tests/${test.id}/questions` },
                  { label: 'Requests', href: `/admin/tests/${test.id}/requests` },
                  { label: 'Results', href: `/admin/tests/${test.id}/results` },
                ].map(({ label, href }) => (
                  <button
                    key={href}
                    onClick={() => router.push(href)}
                    style={outlineBtn}
                  >
                    {label}
                  </button>
                ))}
              </div>

            </div>
          </div>
        ))}
      </div>

      {testToDelete && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-up" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Delete Test?</h3>
              <button onClick={() => setTestToDelete(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to delete this test? This will permanently delete all associated questions, sessions, and submissions. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setTestToDelete(null)}
                style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const id = testToDelete;
                  setTestToDelete(null);
                  await fetch('/api/admin/tests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                    body: JSON.stringify({ action: 'delete_test', id }),
                  });
                  setEditingId(null);
                  fetchData();
                }}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: 'var(--error)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Delete Permanently
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
  background: 'var(--accent)',
  border: '1px solid transparent',
  borderRadius: '3px',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
