'use client';

import { useEffect, useState } from 'react';

interface DashboardData {
  total_students: number;
  started: number;
  submitted: number;
  pending_requests: number;
  active_sessions: Array<{
    session_id: string;
    roll_no: string;
    name: string;
    division: string;
    status: string;
    remaining_seconds: number;
    integrity_warnings: number;
    submitted_count: number;
  }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json();
      setData(d);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleAction = async (sessionId: string, action: 'approve' | 'reject' | 'approve_all' | 'force_submit') => {
    const token = localStorage.getItem('admin_token');
    await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ session_id: sessionId || 'all', action })
    });
    fetchData(); // Refresh immediately
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <p className="text-label" style={{ marginBottom: '8px' }}>Live Overview</p>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Dashboard
        </h1>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px',
        background: 'var(--border)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '32px',
      }}>
        {[
          { label: 'Registered', value: data?.total_students || 0, color: 'var(--text-primary)' },
          { label: 'Pending Approval', value: data?.pending_requests || 0, color: 'var(--warning)' },
          { label: 'Started', value: data?.started || 0, color: 'var(--accent)' },
          { label: 'Submitted', value: data?.submitted || 0, color: 'var(--success)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '24px', background: 'var(--surface-1)' }}>
            <p className="text-label" style={{ marginBottom: '8px' }}>{label}</p>
            <p style={{
              fontSize: '36px',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace',
              color,
              lineHeight: 1,
            }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Live sessions table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <p className="text-label">Active Sessions</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {data?.pending_requests ? (
              <button
                onClick={() => handleAction('', 'approve_all')}
                style={{
                  fontSize: '11px',
                  color: 'var(--success)',
                  background: 'var(--success-dim)',
                  border: '1px solid var(--success)',
                  borderRadius: '3px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Approve All Pending ({data.pending_requests})
              </button>
            ) : null}
            <button
              onClick={fetchData}
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{
          border: '1px solid var(--border)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Roll', 'Name', 'Division', 'Questions', 'Time Left', 'Warnings', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.active_sessions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No active sessions
                  </td>
                </tr>
              )}
              {data?.active_sessions.map((session, i) => (
                <tr key={session.roll_no} style={{
                  borderBottom: i < (data.active_sessions.length - 1) ? '1px solid var(--border-subtle)' : 'none',
                  background: 'var(--surface-1)',
                }}>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-primary)' }}>
                      {session.roll_no}
                    </span>
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{session.name}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{session.division}</span></td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {session.submitted_count}/3
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '12px',
                      color: session.remaining_seconds < 600 ? 'var(--warning)' : 'var(--text-secondary)',
                    }}>
                      {session.status === 'submitted' ? '—' : formatTime(session.remaining_seconds)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: session.integrity_warnings > 0 ? 'var(--warning)' : 'var(--text-muted)',
                    }}>
                      {session.integrity_warnings}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <StatusPill 
                      status={session.status} 
                      sessionId={session.session_id}
                      onApprove={(id) => handleAction(id, 'approve')}
                      onReject={(id) => handleAction(id, 'reject')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, sessionId, onApprove, onReject }: { status: string, sessionId?: string, onApprove?: (id: string) => void, onReject?: (id: string) => void }) {
  if (status === 'pending_approval' && sessionId && onApprove && onReject) {
    return (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => onApprove(sessionId)}
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.10em',
            color: 'var(--success)',
            background: 'var(--success-dim)',
            border: '1px solid var(--success)',
            padding: '3px 7px',
            borderRadius: '2px',
            cursor: 'pointer'
          }}
        >
          APPROVE
        </button>
        <button
          onClick={() => onReject(sessionId)}
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.10em',
            color: 'var(--error)',
            background: 'var(--error-dim)',
            border: '1px solid var(--error)',
            padding: '3px 7px',
            borderRadius: '2px',
            cursor: 'pointer'
          }}
        >
          REJECT
        </button>
      </div>
    );
  }

  const config = {
    active: { label: 'ACTIVE', color: 'var(--accent)', bg: 'var(--accent-dim)' },
    submitted: { label: 'SUBMITTED', color: 'var(--success)', bg: 'var(--success-dim)' },
    expired: { label: 'EXPIRED', color: 'var(--error)', bg: 'var(--error-dim)' },
    pending_approval: { label: 'PENDING', color: 'var(--warning)', bg: 'var(--warning-dim)' },
  }[status] || { label: status.toUpperCase(), color: 'var(--text-muted)', bg: 'var(--surface-2)' };

  return (
    <span style={{
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.10em',
      color: config.color,
      background: config.bg,
      padding: '3px 7px',
      borderRadius: '2px',
    }}>
      {config.label}
    </span>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: '60px', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Loading...</p>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '11px 14px',
  verticalAlign: 'middle',
};
