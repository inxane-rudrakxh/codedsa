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
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [stopModal, setStopModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'selected' | 'all';
    sessionId?: string;
    studentName?: string;
    studentRoll?: string;
    count?: number;
  } | null>(null);
  const [stopping, setStopping] = useState(false);

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

  const handleStopExam = async () => {
    if (!stopModal) return;
    setStopping(true);
    try {
      let body: any = {};
      if (stopModal.type === 'single') {
        body = { action: 'stop', session_id: stopModal.sessionId };
      } else if (stopModal.type === 'selected') {
        body = { action: 'stop', session_ids: selectedSessionIds };
      } else if (stopModal.type === 'all') {
        body = { action: 'stop_all', test_id: testId };
      }

      await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });

      setSelectedSessionIds([]);
      setStopModal(null);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setStopping(false);
    }
  };

  const activeSessionsList = allSessions.filter((s: any) => s.status === 'active');

  const toggleSelectSession = (sessionId: string) => {
    setSelectedSessionIds(prev =>
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  const toggleSelectAll = () => {
    const activeIds = activeSessionsList.map((s: any) => s.session_id).filter(Boolean);
    if (activeIds.length === 0) return;
    const allSelected = activeIds.every(id => selectedSessionIds.includes(id));
    if (allSelected) {
      setSelectedSessionIds(prev => prev.filter(id => !activeIds.includes(id)));
    } else {
      setSelectedSessionIds(prev => Array.from(new Set([...prev, ...activeIds])));
    }
  };

  const displayed = filter === 'pending' ? requests : allSessions;

  const statusColor: Record<string, string> = {
    pending_approval: 'var(--warning, #f0a500)',
    active: 'var(--success)',
    submitted: 'var(--accent)',
    stopped: 'var(--error, #e5534b)',
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
          {requests.length > 0 && filter === 'pending' && (
            <button onClick={handleApproveAll} style={primaryBtn}>
              Approve All ({requests.length})
            </button>
          )}
          {activeSessionsList.length > 0 && filter === 'all' && (
            <button
              onClick={() => setStopModal({
                isOpen: true,
                type: 'all',
                count: activeSessionsList.length
              })}
              style={{
                ...primaryBtn,
                background: 'rgba(229, 83, 75, 0.1)',
                border: '1px solid rgba(229, 83, 75, 0.4)',
                color: 'var(--error, #e5534b)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Stop exam for all active students"
            >
              <span>⏹</span> Stop All Active ({activeSessionsList.length})
            </button>
          )}
        </div>
      </div>

      {/* Multi-Select Action Bar (appears when 1 or more selected) */}
      {selectedSessionIds.length > 0 && filter === 'all' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(229, 83, 75, 0.08)',
          border: '1px solid rgba(229, 83, 75, 0.25)',
          borderRadius: '4px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--error, #e5534b)' }}>
              {selectedSessionIds.length} active student{selectedSessionIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedSessionIds([])}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Deselect All
            </button>
          </div>
          <button
            onClick={() => setStopModal({
              isOpen: true,
              type: 'selected',
              count: selectedSessionIds.length
            })}
            style={{
              padding: '6px 14px',
              background: 'var(--error, #e5534b)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>⏹</span> Stop Selected Exam{selectedSessionIds.length > 1 ? 's' : ''} ({selectedSessionIds.length})
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {filter === 'all' && (
                <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={activeSessionsList.length > 0 && activeSessionsList.every((s: any) => selectedSessionIds.includes(s.session_id))}
                    onChange={toggleSelectAll}
                    disabled={activeSessionsList.length === 0}
                    style={{
                      cursor: activeSessionsList.length > 0 ? 'pointer' : 'default',
                      accentColor: 'var(--error, #e5534b)',
                      width: '14px',
                      height: '14px'
                    }}
                    title={activeSessionsList.length > 0 ? "Select/deselect all active students" : "No active students to select"}
                  />
                </th>
              )}
              {['Student', 'Roll No', 'Branch / Div', 'Status', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={filter === 'all' ? 6 : 5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading requests...
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={filter === 'all' ? 6 : 5} style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {filter === 'pending' ? 'No pending requests.' : 'No sessions for this test yet.'}
                </td>
              </tr>
            ) : (
              displayed.map((r, i) => {
                const isActive = r.status === 'active';
                return (
                  <tr key={r.session_id} style={{
                    borderBottom: i < displayed.length - 1 ? '1px solid var(--border)' : 'none',
                    background: selectedSessionIds.includes(r.session_id) ? 'rgba(229, 83, 75, 0.04)' : undefined
                  }}>
                    {filter === 'all' && (
                      <td style={{ ...tdStyle, textAlign: 'center', width: '40px' }}>
                        {isActive ? (
                          <input
                            type="checkbox"
                            checked={selectedSessionIds.includes(r.session_id)}
                            onChange={() => toggleSelectSession(r.session_id)}
                            style={{
                              cursor: 'pointer',
                              accentColor: 'var(--error, #e5534b)',
                              width: '14px',
                              height: '14px'
                            }}
                            title={`Select ${r.name}`}
                          />
                        ) : (
                          <span style={{ color: 'var(--border)', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    )}
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
                      ) : isActive ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setStopModal({
                              isOpen: true,
                              type: 'single',
                              sessionId: r.session_id,
                              studentName: r.name,
                              studentRoll: r.roll_no
                            })}
                            style={{
                              padding: '5px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--error, #e5534b)',
                              background: 'rgba(229, 83, 75, 0.1)',
                              border: '1px solid rgba(229, 83, 75, 0.4)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              letterSpacing: '0.05em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>⏹</span> STOP EXAM
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Stop Exam Confirmation Modal */}
      {stopModal?.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content animate-fade-up" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', color: 'var(--error, #e5534b)' }}>⏹</span>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                  {stopModal.type === 'single'
                    ? `Stop Exam for ${stopModal.studentName}?`
                    : stopModal.type === 'selected'
                    ? `Stop Exam for ${stopModal.count} Selected Student${stopModal.count! > 1 ? 's' : ''}?`
                    : `Stop Exam for All ${stopModal.count} Active Student${stopModal.count! > 1 ? 's' : ''}?`}
                </h3>
              </div>
              <button
                onClick={() => setStopModal(null)}
                disabled={stopping}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {stopModal.type === 'single' ? (
                  <>
                    Are you sure you want to stop the exam session for <strong>{stopModal.studentName}</strong> (Roll No: <span style={{ fontFamily: 'monospace' }}>{stopModal.studentRoll}</span>)?
                  </>
                ) : stopModal.type === 'selected' ? (
                  <>
                    Are you sure you want to stop the exam session for all <strong>{stopModal.count}</strong> selected students?
                  </>
                ) : (
                  <>
                    Are you sure you want to stop the exam for <strong>all {stopModal.count} currently active</strong> students in this test?
                  </>
                )}
              </p>
              <div style={{
                background: 'rgba(229, 83, 75, 0.08)',
                border: '1px solid rgba(229, 83, 75, 0.25)',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '12px',
                color: 'var(--error, #e5534b)',
                lineHeight: 1.4
              }}>
                <strong>Important:</strong> The student&apos;s active exam will be terminated immediately. Their current code drafts will be retained and submitted.
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setStopModal(null)}
                disabled={stopping}
                style={{
                  padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: '3px', color: 'var(--text-secondary)', fontSize: '11px',
                  fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStopExam}
                disabled={stopping}
                style={{
                  ...primaryBtn,
                  background: 'var(--error, #e5534b)',
                  color: '#ffffff',
                  opacity: stopping ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px'
                }}
              >
                <span>⏹</span> {stopping ? 'Stopping...' : 'Confirm & Stop Exam'}
              </button>
            </div>
          </div>
        </div>
      )}
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
