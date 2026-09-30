'use client';

import { useEffect, useState, useRef } from 'react';

interface Student {
  roll_no: string;
  name: string;
  division: string;
  branch: string;
  is_active: number;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newStudent, setNewStudent] = useState({ roll_no: '', name: '', division: 'AIDS A', branch: 'AI&DS' });
  const [csvError, setCsvError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchStudents = async () => {
    const res = await fetch('/api/admin/students', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setStudents(data.students || []);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleToggle = async (roll_no: string) => {
    await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'toggle', roll_no }),
    });
    fetchStudents();
  };

  const handleAdd = async () => {
    if (!newStudent.roll_no || !newStudent.name) return;
    await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'add', ...newStudent }),
    });
    setShowAdd(false);
    setNewStudent({ roll_no: '', name: '', division: 'AIDS A', branch: 'AI&DS' });
    fetchStudents();
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n');
    const parsed: Array<{ roll_no: string; name: string; division: string; branch: string }> = [];
    let hasError = false;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      if (parts.length < 3) { hasError = true; break; }
      parsed.push({
        roll_no: parts[0],
        name: parts[1],
        division: parts[2],
        branch: parts[3] || 'AI&DS',
      });
    }

    if (hasError) { setCsvError('Invalid CSV format. Expected: roll_no,name,division,branch'); return; }

    await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'import', students: parsed }),
    });
    setCsvError('');
    fetchStudents();
    e.target.value = '';
  };

  const exportCSV = () => {
    const rows = ['roll_no,name,division,branch'];
    students.forEach(s => rows.push(`${s.roll_no},${s.name},${s.division},${s.branch}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
  };

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_no.includes(search);
    const matchDiv = divFilter === 'all' || s.division === divFilter;
    return matchSearch && matchDiv;
  });

  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Management</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Students</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => fileRef.current?.click()} style={outlineBtn}>Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVImport} style={{ display: 'none' }} />
          <button onClick={exportCSV} style={outlineBtn}>Export CSV</button>
          <button onClick={() => setShowAdd(true)} style={primaryBtn}>Add Student</button>
        </div>
      </div>

      {csvError && (
        <div style={{ padding: '12px', background: 'var(--error-dim)', border: '1px solid var(--error)', borderRadius: '4px', marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--error)' }}>{csvError}</p>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search by name or roll no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...filterInput, flex: 1, maxWidth: '300px' }}
        />
        <select value={divFilter} onChange={e => setDivFilter(e.target.value)} style={filterInput}>
          <option value="all">All Divisions</option>
          <option value="AIDS A">AIDS A</option>
          <option value="AIDS B">AIDS B</option>
        </select>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>
          {filtered.length} students
        </span>
      </div>

      {/* Add student form */}
      {showAdd && (
        <div style={{
          padding: '20px',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          background: 'var(--surface-1)',
          marginBottom: '16px',
        }}>
          <p className="text-label" style={{ marginBottom: '16px' }}>Add Student</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
            {[
              { label: 'Roll No', key: 'roll_no', placeholder: '21' },
              { label: 'Name', key: 'name', placeholder: 'STUDENT NAME' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={newStudent[key as keyof typeof newStudent]}
                  onChange={e => setNewStudent(prev => ({ ...prev, [key]: e.target.value }))}
                  style={filterInput}
                />
              </div>
            ))}
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Division</p>
              <select
                value={newStudent.division}
                onChange={e => setNewStudent(prev => ({ ...prev, division: e.target.value }))}
                style={filterInput}
              >
                <option>AIDS A</option>
                <option>AIDS B</option>
              </select>
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: '4px' }}>Branch</p>
              <input type="text" value="AI&DS" disabled style={{ ...filterInput, opacity: 0.5 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowAdd(false)} style={outlineBtn}>Cancel</button>
            <button onClick={handleAdd} style={primaryBtn}>Add</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Roll No', 'Name', 'Division', 'Branch', 'Status', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No students found</td></tr>
            ) : (
              filtered.map((s, i) => (
                <tr key={s.roll_no} style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: 'var(--surface-1)',
                  opacity: s.is_active ? 1 : 0.5,
                }}>
                  <td style={tdStyle}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-primary)' }}>{s.roll_no}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.name}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.division}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.branch}</span></td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.10em',
                      color: s.is_active ? 'var(--success)' : 'var(--text-muted)',
                      background: s.is_active ? 'var(--success-dim)' : 'var(--surface-2)',
                      padding: '3px 7px',
                      borderRadius: '2px',
                    }}>
                      {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleToggle(s.roll_no)}
                      style={{
                        fontSize: '11px',
                        color: s.is_active ? 'var(--error)' : 'var(--success)',
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: '3px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.10em',
  textTransform: 'uppercase' as const,
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)',
};

const tdStyle: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'middle' };

const filterInput: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  color: 'var(--text-secondary)',
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
