'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { HelpCircle, Clock, BarChart3 } from 'lucide-react';

export default function TestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;

  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editData, setEditData] = useState<any>({});
  const [editing, setEditing] = useState(false);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [testToDelete, setTestToDelete] = useState(false);

  const SUPPORTED_LANGS = [
    { id: 'c', label: 'C' },
    { id: 'cpp', label: 'C++' },
    { id: 'python', label: 'Python' },
    { id: 'java', label: 'Java' },
  ];

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchTest = async () => {
    const res = await fetch('/api/admin/tests', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { router.push('/admin/tests'); return; }
    const data = await res.json();
    const found = (data.tests || []).find((t: any) => t.id === testId);
    if (!found) { router.push('/admin/tests'); return; }
    setTest(found);
    setEditData(found);
    setDivisions(data.divisions || []);
    setLoading(false);
  };

  useEffect(() => { fetchTest(); }, [testId]);

  const handleUpdate = async () => {
    let payload: any = { action: 'update_test', id: testId, ...editData };
    if (payload.start_time) payload.start_time = new Date(payload.start_time).toISOString();
    if (payload.end_time) payload.end_time = new Date(payload.end_time).toISOString();
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(payload),
    });
    setEditing(false);
    fetchTest();
  };

  const handleDelete = async () => {
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'delete_test', id: testId }),
    });
    router.push('/admin/tests');
  };

  if (loading) return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>;
  if (!test) return null;

  const sections = [
    { href: `/admin/tests/${testId}/questions`, label: 'Questions', desc: `${test.testQuestions?.length || 0} assigned`, icon: HelpCircle },
    { href: `/admin/tests/${testId}/requests`, label: 'Requests', desc: 'Pending approvals', icon: Clock },
    { href: `/admin/tests/${testId}/results`, label: 'Results', desc: 'Student submissions', icon: BarChart3 },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/admin/tests" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Tests</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)' }}>{test.title}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Test Detail</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '6px' }}>
            {test.title}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {test.subject?.name} · {test.duration_minutes} min · {test.total_marks} marks · {test.questions_per_student} Qs/student
            {test.target_division ? ` · Div ${test.target_division}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {test.status === 'PUBLISHED' && test.unique_id && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${test.unique_id}`);
                alert('Test link copied!');
              }}
              style={outlineBtn}
            >
              Copy Link
            </button>
          )}
          <span style={{
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', padding: '5px 10px', borderRadius: '3px',
            background: test.status === 'PUBLISHED' ? 'var(--success-dim)' : 'var(--surface-2)',
            color: test.status === 'PUBLISHED' ? 'var(--success)' : 'var(--text-muted)',
          }}>
            {test.status}
          </span>
          <button onClick={() => setEditing(!editing)} style={outlineBtn}>
            {editing ? 'Cancel' : 'Edit Settings'}
          </button>
        </div>
      </div>

      {/* Edit settings panel */}
      {editing && (
        <div style={{ padding: '20px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '32px' }}>
          <p className="text-label" style={{ marginBottom: '16px' }}>Edit Test Settings</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Title</p>
              <input value={editData.title || ''} onChange={e => setEditData((p: any) => ({ ...p, title: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Status</p>
              <select value={editData.status || 'DRAFT'} onChange={e => setEditData((p: any) => ({ ...p, status: e.target.value }))} style={inputStyle}>
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Duration (mins)</p>
              <input type="number" value={editData.duration_minutes || 60} onChange={e => setEditData((p: any) => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Total Marks</p>
              <input type="number" value={editData.total_marks || 30} onChange={e => setEditData((p: any) => ({ ...p, total_marks: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Qs per Student</p>
              <input type="number" value={editData.questions_per_student || 3} onChange={e => setEditData((p: any) => ({ ...p, questions_per_student: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Target Division</p>
              <select value={editData.target_division || ''} onChange={e => setEditData((p: any) => ({ ...p, target_division: e.target.value }))} style={inputStyle}>
                <option value="">All Divisions</option>
                {divisions.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <p className="text-label" style={{ marginBottom: '4px' }}>Instructions</p>
              <textarea value={editData.instructions || ''} onChange={e => setEditData((p: any) => ({ ...p, instructions: e.target.value }))} style={{ ...inputStyle, height: '72px', resize: 'vertical' }} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Start Time</p>
              <input type="datetime-local" value={editData.start_time ? new Date(new Date(editData.start_time).getTime() - new Date(editData.start_time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setEditData((p: any) => ({ ...p, start_time: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>End Time</p>
              <input type="datetime-local" value={editData.end_time ? new Date(new Date(editData.end_time).getTime() - new Date(editData.end_time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setEditData((p: any) => ({ ...p, end_time: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <p className="text-label" style={{ marginBottom: '8px' }}>Allowed Languages</p>
              <div style={{ display: 'flex', gap: '16px' }}>
                {SUPPORTED_LANGS.map(lang => {
                  const langs: string[] = editData.allowed_languages || ['c', 'cpp', 'python', 'java'];
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
                              : langs.filter((l: string) => l !== lang.id),
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
            <button onClick={() => setTestToDelete(true)} style={{ ...outlineBtn, color: 'var(--error)', borderColor: 'var(--error-dim)' }}>
              Delete Test
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditing(false)} style={outlineBtn}>Cancel</button>
              <button onClick={handleUpdate} style={primaryBtn}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-section cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {sections.map(s => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '24px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
            >
              <div style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>
                <s.icon size={26} strokeWidth={1.75} />
              </div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {testToDelete && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-up" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Delete Test?</h3>
              <button onClick={() => setTestToDelete(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                This will permanently delete all sessions, submissions, and results for this test. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setTestToDelete(false)} style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={handleDelete} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: 'var(--error)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: '3px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
};
const outlineBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px',
  color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', cursor: 'pointer',
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--accent)', border: '1px solid transparent', borderRadius: '3px',
  color: '#ffffff', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', cursor: 'pointer',
};
