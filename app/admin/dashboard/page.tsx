'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Code } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading Dashboard...</div>
    );
  }

  // Calculate metrics
  const activeTestsCount = data?.tests_summary?.filter((t: any) => t.status === 'PUBLISHED').length || 0;
  const pendingRequests = data?.pending_requests || 0;
  const pendingReviews = data?.active_sessions?.filter((s: any) => s.status === 'submitted' && !data.tests_summary.find((t: any) => t.id === s.test_id)?.marks_published).length || 0;

  const publishedTests = data?.tests_summary?.filter((t: any) => t.status === 'PUBLISHED') || [];
  const recentTests = data?.tests_summary?.slice(0, 5) || [];

  return (
    <div>
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Good morning, Admin.
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
            Manage your coding assessments and live student access requests.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/admin/tests/create')}
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              padding: '12px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Code size={15} /> + CREATE CODING TEST
          </button>

        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
        <div 
          onClick={() => router.push('/admin/tests')}
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px', cursor: 'pointer' }}
        >
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>ACTIVE TESTS</p>
          <p style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text-primary)' }}>{activeTestsCount}</p>
        </div>
        
        <div 
          onClick={() => router.push('/admin/requests')}
          style={{
            background: pendingRequests > 0 ? 'var(--warning-dim)' : 'var(--surface-1)',
            border: `1.5px solid ${pendingRequests > 0 ? 'var(--warning)' : 'var(--border)'}`,
            borderRadius: '8px',
            padding: '24px',
            cursor: 'pointer',
            transition: 'transform 0.1s ease',
          }}
          title="Click to view and approve access requests"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: pendingRequests > 0 ? 'var(--warning)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ACCESS REQUESTS
            </p>
            {pendingRequests > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warning)', background: 'rgba(232, 165, 90, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                LIVE ACTION
              </span>
            )}
          </div>
          <p style={{ fontSize: '32px', fontWeight: 700, color: pendingRequests > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {pendingRequests}
          </p>
          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600, display: 'inline-block', marginTop: '4px' }}>
            Review Access Requests →
          </span>
        </div>

        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>PENDING REVIEWS</p>
          <p style={{ fontSize: '32px', fontWeight: 600, color: 'var(--text-primary)' }}>{pendingReviews}</p>
        </div>
      </div>

      {publishedTests.length > 0 && (
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            ACTIVE ASSESSMENTS
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {publishedTests.map((t: any) => {
              const testSessions = data?.active_sessions?.filter((s: any) => s.test_title === t.title) || [];
              const activeCount = testSessions.filter((s: any) => s.status === 'active').length;
              const submittedCount = testSessions.filter((s: any) => s.status === 'submitted').length;
              const waitingCount = testSessions.filter((s: any) => s.status === 'pending_approval').length;
              const total = testSessions.length;


              return (
                <div key={t.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>{t.title}</h3>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', padding: '3px 7px', borderRadius: '3px', background: 'var(--success-dim)', color: 'var(--success)', textTransform: 'uppercase' }}>
                          LIVE
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div>
                      <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{total}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Participants</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{activeCount}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{submittedCount}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Submitted</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '20px', fontWeight: 700, color: waitingCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{waitingCount}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Waiting Approval</p>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    {waitingCount > 0 && (
                      <button 
                        onClick={() => router.push(`/admin/tests/${t.id}/requests`)}
                        style={{ flex: 1, padding: '10px', background: 'var(--warning)', color: '#000', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        APPROVE ({waitingCount})
                      </button>
                    )}
                    <button 
                      onClick={() => router.push(`/admin/tests/${t.id}`)}
                      style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      OPEN TEST
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
          RECENT ASSESSMENTS
        </h2>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Test</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Participants</th>
              </tr>
            </thead>
            <tbody>
              {recentTests.map((t: any) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{t.title}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ fontSize: '12px', color: t.status === 'PUBLISHED' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 500 }}>
                      {t.status === 'PUBLISHED' ? 'Published' : t.status === 'DRAFT' ? 'Draft' : 'Ended'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {t.session_count > 0 ? t.session_count : '—'}
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
