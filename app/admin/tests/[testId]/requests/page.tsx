'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface RequestRow {
  session_id: string;
  test_title: string;
  name: string;
  roll_no: string;
  branch: string;
  division: string;
  requested_at?: string;
  status: string;
}

export default function TestRequestsPage() {
  const params = useParams();
  const testId = params.testId as string;

  const [testTitle, setTestTitle] = useState('');
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const getToken = () => localStorage.getItem('admin_token') || '';

  const fetchData = async () => {
    const res = await fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { setLoading(false); return; }
    const d = await res.json();

    // Find test title
    const testSummary = (d.tests_summary || []).find((t: any) => t.id === testId);
    setTestTitle(testSummary?.title || testId);

    // Filter sessions for this test only
    const sessions: any[] = d.active_sessions || [];
    const forThisTest = sessions.filter((s: any) => s.test_id === testId);

    setAllSessions(forThisTest);
    setRequests(forThisTest.filter((s: any) => s.status === 'pending_approval'));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [testId]);

  const handleAction = async (sessionId: string, action: 'approve' | 'reject') => {
    await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ session_id: sessionId, action }),
    });
    setRequests(p => p.filter(r => r.session_id !== sessionId));
    setAllSessions(p => p.map(s => s.session_id === sessionId ? { ...s, status: action === 'approve' ? 'active' : 'rejected' } : s));
  };

  const handleApproveAll = async () => {
    await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ action: 'approve_all' }),
    });
    setRequests([]);
    fetchData();
  };

  const displayed = filter === 'pending' ? requests : allSessions;

  const statusColor: Record<string, string> = {
    pending_approval: 'var(--warning, #f0a500)',
    active: 'var(--success)',
    submitted: 'var(--accent)',
    expired: 'var(--text-muted)',
    rejected: 'var(--error)',
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/admin/tests" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Tests</Link>
        <span>›</span>
        <Link href={`/admin/tests/${testId}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{testTitle || testId}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)' }}>Requests</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="text-label" style={{ marginBottom: '8px' }}>Test · Access Requests</p>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Live Access Requests
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {requests.length} pending · auto-refreshes every 3s
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            {(['pending', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '7px 14px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                  background: filter === f ? 'var(--text-primary)' : 'var(--surface-2)',
                  color: filter === f ? 'var(--bg)' : 'var(--text-secondary)',
                }}
              >
                {f === 'pending' ? `Pending (${requests.length})` : `All (${allSessions.length})`}
              </button>
            ))}
          </div>
          {requests.length > 0 && (
            <button onClick={handleApproveAll} style={primaryBtn}>
              Approve All ({requests.length})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {['Student', 'Roll No', 'Branch / Div', 'Status', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading requests...
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {filter === 'pending' ? 'No pending requests.' : 'No sessions for this test yet.'}
                </td>
              </tr>
            ) : (
              displayed.map((r, i) => (
                <tr key={r.session_id} style={{ borderBottom: i < displayed.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.roll_no}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.branch} · {r.division}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: statusColor[r.status] || 'var(--text-muted)',
                      background: 'var(--surface-2)',
                      padding: '3px 7px', borderRadius: '2px',
                    }}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {r.status === 'pending_approval' ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleAction(r.session_id, 'reject')}
                          style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.06em' }}
                        >
                          REJECT
                        </button>
                        <button
                          onClick={() => handleAction(r.session_id, 'approve')}
                          style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 600, color: '#fff', background: 'var(--success)', border: 'none', borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.06em' }}
                        >
                          APPROVE
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                    )}
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
  padding: '10px 20px', textAlign: 'left', fontSize: '10px', fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)',
};
const tdStyle: React.CSSProperties = { padding: '14px 20px', verticalAlign: 'middle' };
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--accent)', border: '1px solid transparent', borderRadius: '3px',
  color: '#ffffff', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', cursor: 'pointer',
};
