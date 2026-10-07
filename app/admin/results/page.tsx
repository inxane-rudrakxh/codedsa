'use client';

import { useEffect, useState } from 'react';

interface TestSummary {
  id: string;
  title: string;
  subject: string;
  status: string;
  marks_published: boolean;
  session_count: number;
}

interface QuestionResult {
  question_id: string;
  question_title: string;
  order_index: number;
  submission_id: string | null;
  source_code: string | null;
  status: string | null;
  passed_test_cases: number | null;
  total_test_cases: number | null;
  marks_awarded: number | null;
  max_marks: number;
}

interface ResultRow {
  roll_no: string;
  name: string;
  division: string;
  branch: string;
  session_id: string | null;
  status: string | null;
  is_submitted: number;
  start_time: string | null;
  end_time: string | null;
  integrity_warnings: number;
  questions: QuestionResult[];
  total_score: number;
  max_total: number;
}

export default function ResultsPage() {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [testsLoading, setTestsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCode, setSelectedCode] = useState<{
    name: string; roll: string; q: QuestionResult; editMarks: number;
  } | null>(null);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [sessionToReset, setSessionToReset] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const getToken = () => localStorage.getItem('admin_token') || '';

  // Load tests list
  useEffect(() => {
    fetch('/api/admin/results', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => { setTests(data.tests || []); setTestsLoading(false); });
  }, []);

  const loadResults = async (testId: string) => {
    setLoading(true);
    setResults([]);
    setReportData(null);
    const res = await fetch(`/api/admin/results?test_id=${testId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setResults(data.results || []);
    setSelectedTest(data.test || null);
    setLoading(false);
  };

  const handleSelectTest = (id: string) => {
    setSelectedTestId(id);
    if (id) loadResults(id);
  };

  const handleUpdateMarks = async () => {
    if (!selectedCode) return;
    if (!selectedCode.q.submission_id) return;
    await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'update_marks', submission_id: selectedCode.q.submission_id, marks_awarded: selectedCode.editMarks }),
    });
    setSelectedCode(null);
    loadResults(selectedTestId);
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    const res = await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'generate_report', test_id: selectedTestId }),
    });
    const data = await res.json();
    if (data.success) { setReportData(data.data); }
    setGenerating(false);
  };

  const handlePublishMarks = async () => {
    await fetch('/api/admin/tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'publish_marks', id: selectedTestId }),
    });
    // Reload test info
    setTests(prev => prev.map(t => t.id === selectedTestId ? { ...t, marks_published: true } : t));
    setSelectedTest((prev: any) => prev ? { ...prev, marks_published: true } : prev);
  };

  const handleResetSession = async (sessionId: string) => {
    setLoading(true);
    await fetch('/api/admin/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'reset_session', session_id: sessionId }),
    });
    await loadResults(selectedTestId);
  };

  const exportCSV = () => {
    if (!reportData) return;
    const keys = Object.keys(reportData[0] || {});
    const rows = [keys.join(','), ...reportData.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTest?.title || 'results'}_marks.csv`;
    a.click();
  };

  const divisions = [...new Set(results.map(r => r.division).filter(Boolean))];

  const filtered = results.filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.roll_no.toLowerCase().includes(search.toLowerCase());
    const matchDiv = divFilter === 'all' || r.division === divFilter;
    const sStatus = r.is_submitted ? 'submitted' : (r.session_id ? 'active' : 'not_started');
    const matchStatus = statusFilter === 'all' || sStatus === statusFilter;
    return matchSearch && matchDiv && matchStatus;
  });

  const submittedCount = results.filter(r => r.is_submitted).length;
  const avgScore = submittedCount > 0
    ? (results.filter(r => r.is_submitted).reduce((acc, r) => acc + r.total_score, 0) / submittedCount).toFixed(1)
    : '—';

  const maxQuestions = Math.max(...results.map(r => r.questions.length), 0);
  const qHeaders = Array.from({ length: maxQuestions }, (_, i) => `Q${i + 1}`);

  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Evaluation</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Results</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selectedTestId && !selectedTest?.marks_published && (
            <button onClick={handlePublishMarks} style={{ ...outlineBtn, color: 'var(--success)', borderColor: 'var(--success)' }}>
              Publish Marks to Students
            </button>
          )}
          {selectedTestId && (
            <button onClick={handleGenerateReport} disabled={generating} style={outlineBtn}>
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          )}
          {reportData && (
            <button onClick={exportCSV} style={primaryBtn}>Download CSV</button>
          )}
        </div>
      </div>

      {/* Test selector */}
      <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '4px' }}>
        <p className="text-label" style={{ marginBottom: '8px' }}>Select Test</p>
        {testsLoading ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading tests...</p>
        ) : tests.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No tests found. Create a test first.</p>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {tests.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectTest(t.id)}
                style={{
                  padding: '8px 14px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', fontWeight: 500,
                  background: selectedTestId === t.id ? 'var(--text-primary)' : 'var(--surface-2)',
                  color: selectedTestId === t.id ? 'var(--bg)' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                {t.title}
                {t.marks_published && <span style={{ marginLeft: '6px', fontSize: '9px', color: selectedTestId === t.id ? 'rgba(255,255,255,0.7)' : 'var(--success)' }}>✓ PUBLISHED</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTestId && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
            {[
              { label: 'Total Students', value: results.length },
              { label: 'Submitted', value: submittedCount },
              { label: 'Avg Score', value: submittedCount > 0 ? `${avgScore}/${selectedTest?.total_marks || '?'}` : '—' },
              { label: 'Marks Published', value: selectedTest?.marks_published ? 'YES' : 'NO' },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '16px 20px', background: 'var(--surface-1)' }}>
                <p className="text-label" style={{ marginBottom: '4px' }}>{label}</p>
                <p style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'Söhne Mono, ui-monospace, monospace', color: 'var(--text-primary)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Search by name or roll..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...filterInput, flex: 1, maxWidth: '260px' }} />
            <select value={divFilter} onChange={e => setDivFilter(e.target.value)} style={filterInput}>
              <option value="all">All Divisions</option>
              {divisions.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterInput}>
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="active">Active</option>
              <option value="not_started">Not Started</option>
            </select>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>{filtered.length} students</span>
          </div>

          {/* Table */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Roll', 'Name', 'Div', ...qHeaders, 'Total', 'Status', 'Warnings', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8 + qHeaders.length} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading results...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8 + qHeaders.length} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No results found.</td></tr>
                ) : filtered.map((r, i) => {
                  const sStatus = r.is_submitted ? 'submitted' : (r.session_id ? 'active' : 'not_started');
                  return (
                    <tr key={r.roll_no} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--surface-1)' }}>
                      <td style={tdStyle}><span style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '12px', color: 'var(--text-primary)' }}>{r.roll_no}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.name}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.division}</span></td>
                      {qHeaders.map((_, qi) => {
                        const q = r.questions.find(q => q.order_index === qi);
                        return (
                          <td key={qi} style={tdStyle}>
                            {q && q.submission_id ? (
                              <button
                                onClick={() => setSelectedCode({ name: r.name, roll: r.roll_no, q, editMarks: q.marks_awarded ?? 0 })}
                                style={{
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '13px',
                                  textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px',
                                  color: q.marks_awarded === null ? 'var(--text-muted)' : q.marks_awarded >= q.max_marks * 0.7 ? 'var(--success)' : q.marks_awarded >= q.max_marks * 0.4 ? 'var(--warning, #f0a500)' : 'var(--error)',
                                }}
                              >
                                {q.marks_awarded !== null ? `${q.marks_awarded}/${q.max_marks}` : `?/${q.max_marks}`}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '13px' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '13px', fontWeight: 600, color: r.is_submitted ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {r.is_submitted ? `${r.total_score}/${r.max_total}` : '—'}
                        </span>
                      </td>
                      <td style={tdStyle}><StatusPill status={sStatus} /></td>
                      <td style={tdStyle}>
                        {r.integrity_warnings > 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--error)', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>⚠ {r.integrity_warnings}</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {r.session_id ? (
                          <button
                            onClick={() => setSessionToReset(r.session_id!)}
                            style={{
                              background: 'transparent', border: '1px solid var(--error-dim)', borderRadius: '3px',
                              color: 'var(--error)', fontSize: '10px', padding: '4px 8px', cursor: 'pointer',
                              fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase'
                            }}
                          >
                            Reset
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Code Viewer + Marks Editor Modal */}
      {selectedCode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '20px' }}>
          <div className="animate-fade-up" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '860px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>
                  {selectedCode.roll} · {selectedCode.name} — Q{selectedCode.q.order_index + 1}: {selectedCode.q.question_title}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedCode.q.passed_test_cases}/{selectedCode.q.total_test_cases} test cases passed
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Marks (/{selectedCode.q.max_marks}):</span>
                  <input
                    type="number"
                    min="0"
                    max={selectedCode.q.max_marks}
                    value={selectedCode.editMarks}
                    onChange={e => setSelectedCode({ ...selectedCode, editMarks: parseFloat(e.target.value) || 0 })}
                    style={{ ...filterInput, width: '70px', padding: '4px 8px' }}
                  />
                  <button onClick={handleUpdateMarks} style={{ ...primaryBtn, padding: '6px 14px' }}>Save</button>
                </div>
                <button onClick={() => setSelectedCode(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '22px', cursor: 'pointer' }}>×</button>
              </div>
            </div>
            <div style={{ padding: '24px', overflow: 'auto', flex: 1, background: 'var(--surface-1)' }}>
              <pre style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '13px', color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selectedCode.q.source_code || '// No code submitted'}
              </pre>
            </div>
          </div>
        </div>
      )}
      {sessionToReset && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--surface-1)', padding: '24px', borderRadius: '8px',
            width: '400px', border: '1px solid var(--border)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Reset Session?</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you sure you want to completely reset this session? All code and marks will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setSessionToReset(null)}
                style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  const id = sessionToReset;
                  setSessionToReset(null);
                  await handleResetSession(id);
                }}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: 'var(--error)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      )}
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
  return <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.10em', color: c.color, background: c.bg, padding: '3px 7px', borderRadius: '2px' }}>{c.label}</span>;
}

const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' };
const tdStyle: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };
const filterInput: React.CSSProperties = { padding: '8px 12px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', fontSize: '13px', outline: 'none' };
const outlineBtn: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' };
const primaryBtn: React.CSSProperties = { padding: '8px 16px', background: 'var(--accent)', border: '1px solid transparent', borderRadius: '3px', color: '#ffffff', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' };
