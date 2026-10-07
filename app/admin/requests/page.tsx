'use client';

import { useEffect, useState } from 'react';

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

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const d = await res.json();
      const pending = d.active_sessions?.filter((s: any) => s.status === 'pending_approval') || [];
      setRequests(pending);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (sessionId: string, action: 'approve' | 'reject') => {
    const token = localStorage.getItem('admin_token');
    await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ session_id: sessionId, action })
    });
    // Optimistic update
    setRequests(p => p.filter(r => r.session_id !== sessionId));
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          LIVE ACCESS REQUESTS
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Review and approve students waiting to enter an assessment.
        </p>
      </div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Test</th>
              <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Student</th>
              <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Roll No</th>
              <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Branch</th>
              <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading requests...</td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No pending requests.
                </td>
              </tr>
            ) : (
              requests.map(r => (
                <tr key={r.session_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.test_title}</td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-primary)' }}>{r.name}</td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'Söhne Mono, ui-monospace, monospace' }}>{r.roll_no}</td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-secondary)' }}>{r.branch}-{r.division}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleAction(r.session_id, 'reject')}
                        style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        REJECT
                      </button>
                      <button 
                        onClick={() => handleAction(r.session_id, 'approve')}
                        style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, color: '#fff', background: 'var(--success)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        APPROVE
                      </button>
                    </div>
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
