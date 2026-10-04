'use client';

import { useEffect, useState } from 'react';

interface Teacher {
  id: string;
  email: string;
  full_name: string;
  status: string;
  department: string;
  subject: string;
  test_count: number;
  question_count: number;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [form, setForm] = useState({ email: '', full_name: '', password: '', department: '', subject: '' });
  const [msg, setMsg] = useState('');

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetch_teachers = async () => {
    const res = await fetch('/api/admin/teachers', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setTeachers(data.teachers || []);
    setLoading(false);
  };

  useEffect(() => { fetch_teachers(); }, []);

  const handleAdd = async () => {
    if (!form.email || !form.full_name || !form.password) return;
    const res = await fetch('/api/admin/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'add', ...form }),
    });
    const data = await res.json();
    if (data.success) {
      setMsg('Teacher added successfully!');
      setShowAdd(false);
      setForm({ email: '', full_name: '', password: '', department: '', subject: '' });
      fetch_teachers();
    } else {
      setMsg(data.error || 'Failed to add teacher.');
    }
  };

  const handleToggle = async (id: string) => {
    await fetch('/api/admin/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'toggle_status', id }),
    });
    fetch_teachers();
  };

  const handleResetPassword = async (id: string) => {
    if (!newPass || newPass.length < 6) { setMsg('Password must be at least 6 characters.'); return; }
    await fetch('/api/admin/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'reset_password', id, new_password: newPass }),
    });
    setResetting(null);
    setNewPass('');
    setMsg('Password reset successfully.');
  };

  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Management</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Faculty / Teachers</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Each teacher manages their own tests, questions, and results.</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={primaryBtn}>Add Teacher</button>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {showAdd && (
        <div style={{ padding: '24px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <p className="text-label" style={{ marginBottom: '16px' }}>Add New Teacher</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            {[
              { label: 'Full Name', key: 'full_name', placeholder: 'Prof. Kiran K.' },
              { label: 'Email Address', key: 'email', placeholder: 'faculty@college.edu' },
              { label: 'Password', key: 'password', placeholder: 'Minimum 6 characters', type: 'password' },
              { label: 'Department', key: 'department', placeholder: 'e.g. Computer Engineering' },
              { label: 'Subject', key: 'subject', placeholder: 'e.g. Data Structures' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
                <input
                  type={type || 'text'}
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowAdd(false)} style={outlineBtn}>Cancel</button>
            <button onClick={handleAdd} style={primaryBtn}>Add Teacher</button>
          </div>
        </div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Name', 'Email', 'Department / Subject', 'Tests', 'Questions', 'Status', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</td></tr>
            ) : teachers.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No teachers added yet. Click "Add Teacher" to get started.</td></tr>
            ) : teachers.map((t, i) => (
              <tr key={t.id} style={{ borderBottom: i < teachers.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--surface-1)' }}>
                <td style={tdStyle}><span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '13px' }}>{t.full_name}</span></td>
                <td style={tdStyle}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>{t.email}</span></td>
                <td style={tdStyle}><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.department || '—'} / {t.subject || '—'}</span></td>
                <td style={tdStyle}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-primary)' }}>{t.test_count}</span></td>
                <td style={tdStyle}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-primary)' }}>{t.question_count}</span></td>
                <td style={tdStyle}>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.10em',
                    color: t.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-muted)',
                    background: t.status === 'ACTIVE' ? 'var(--success-dim)' : 'var(--surface-2)',
                    padding: '3px 7px', borderRadius: '2px',
                  }}>{t.status}</span>
                </td>
                <td style={{ ...tdStyle, display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleToggle(t.id)}
                    style={{
                      fontSize: '11px', padding: '4px 10px', borderRadius: '3px', cursor: 'pointer',
                      background: 'none', border: '1px solid var(--border)',
                      color: t.status === 'ACTIVE' ? 'var(--error)' : 'var(--success)',
                    }}
                  >{t.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button>
                  {resetting === t.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input
                        type="password"
                        placeholder="New password"
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        style={{ ...inputStyle, padding: '4px 8px', width: '120px', fontSize: '12px' }}
                      />
                      <button onClick={() => handleResetPassword(t.id)} style={{ ...primaryBtn, padding: '4px 8px', fontSize: '11px' }}>Save</button>
                      <button onClick={() => { setResetting(null); setNewPass(''); }} style={{ ...outlineBtn, padding: '4px 8px', fontSize: '11px' }}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResetting(t.id)}
                      style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '3px', cursor: 'pointer', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    >Reset Password</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' };
const tdStyle: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'middle' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', fontSize: '13px', outline: 'none' };
const outlineBtn: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' };
const primaryBtn: React.CSSProperties = { padding: '8px 16px', background: 'var(--text-primary)', border: '1px solid transparent', borderRadius: '3px', color: 'var(--bg)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' };
