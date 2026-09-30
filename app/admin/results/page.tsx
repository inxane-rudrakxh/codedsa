'use client';

import { useEffect, useState } from 'react';

interface ResultRow {
  roll_no: string;
  name: string;
  division: string;
  branch: string;
  session_id: string | null;
  status: string | null;
  q1_score: number | null;
  q2_score: number | null;
  q3_score: number | null;
  total_score: number;
  end_time: string | null;
  is_submitted: number | null;
}

export default function ResultsPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'roll' | 'score'>('roll');

  const getToken = () => localStorage.getItem('admin_token') || '';

  useEffect(() => {
    fetch('/api/admin/results', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => {
        setResults(data.results || []);
        setLoading(false);
      });
  }, []);

  const exportCSV = () => {
    const rows = ['Roll,Name,Division,Q1,Q2,Q3,Total,Status'];
    filtered.forEach(r => {
      rows.push([
        r.roll_no, r.name, r.division,
        r.q1_score ?? '', r.q2_score ?? '', r.q3_score ?? '',
        r.total_score,
        r.is_submitted ? 'Submitted' : (r.session_id ? 'Active' : 'Not Started'),
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.csv';
    a.click();
  };

  const filtered = results
    .filter(r => {
      const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.roll_no.includes(search);
      const matchDiv = divFilter === 'all' || r.division === divFilter;
      const studentStatus = r.is_submitted ? 'submitted' : (r.session_id ? 'active' : 'not_started');
      const matchStatus = statusFilter === 'all' || studentStatus === statusFilter;
      return matchSearch && matchDiv && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return b.total_score - a.total_score;
      return parseInt(a.roll_no) - parseInt(b.roll_no);
    });

  const totalSubmitted = results.filter(r => r.is_submitted).length;
  const avgScore = totalSubmitted > 0
    ? Math.round(results.filter(r => r.is_submitted).reduce((acc, r) => acc + r.total_score, 0) / totalSubmitted)
    : 0;

  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Evaluation</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Results</h1>
        </div>
        <button onClick={exportCSV} style={outlineBtn}>Export CSV</button>
      </div>

      {/* Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1px',
        background: 'var(--border)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '24px',
      }}>
        {[
          { label: 'Total Students', value: results.length },
          { label: 'Submitted', value: totalSubmitted },
          { label: 'Avg Score', value: totalSubmitted > 0 ? `${avgScore}/30` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '20px', background: 'var(--surface-1)' }}>
            <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
            <p style={{
              fontSize: '28px',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-primary)',
            }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...filterInput, width: '220px' }}
        />
        <select value={divFilter} onChange={e => setDivFilter(e.target.value)} style={filterInput}>
          <option value="all">All Divisions</option>
          <option value="AIDS A">AIDS A</option>
          <option value="AIDS B">AIDS B</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterInput}>
          <option value="all">All Status</option>
          <option value="submitted">Submitted</option>
          <option value="active">Active</option>
          <option value="not_started">Not Started</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'roll' | 'score')} style={filterInput}>
          <option value="roll">Sort: Roll No</option>
          <option value="score">Sort: Score (High)</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {['Roll', 'Name', 'Division', 'Q1', 'Q2', 'Q3', 'Total', 'Status'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No results found</td></tr>
            ) : (
              filtered.map((r, i) => {
                const status = r.is_submitted ? 'submitted' : (r.session_id ? 'active' : 'not_started');
                return (
                  <tr key={r.roll_no} style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    background: 'var(--surface-1)',
                  }}>
                    <td style={tdStyle}><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-primary)' }}>{r.roll_no}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.name}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.division}</span></td>
                    {[r.q1_score, r.q2_score, r.q3_score].map((score, si) => (
                      <td key={si} style={tdStyle}>
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '13px',
                          color: score !== null ? (score >= 8 ? 'var(--success)' : score >= 5 ? 'var(--warning)' : 'var(--error)') : 'var(--text-muted)',
                        }}>
                          {score !== null ? score : '—'}
                        </span>
                      </td>
                    ))}
                    <td style={tdStyle}>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: r.is_submitted ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}>
                        {r.is_submitted ? r.total_score : '—'}<span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{r.is_submitted ? '/30' : ''}</span>
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <StatusPill status={status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    submitted: { label: 'SUBMITTED', color: 'var(--success)', bg: 'var(--success-dim)' },
    active: { label: 'ACTIVE', color: 'var(--accent)', bg: 'var(--accent-dim)' },
    not_started: { label: 'NOT STARTED', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
  };
  const c = config[status] || config.not_started;
  return (
    <span style={{
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.10em',
      color: c.color,
      background: c.bg,
      padding: '3px 7px',
      borderRadius: '2px',
    }}>{c.label}</span>
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
