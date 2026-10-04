'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: username, password, role: 'ADMIN' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      localStorage.setItem('admin_token', data.token);
      router.push('/admin/dashboard');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg-gradient)',
      backgroundAttachment: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div className="animate-fade-up glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '40px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ marginBottom: '48px', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '-20px',
            width: '80px',
            height: '80px',
            background: 'var(--accent)',
            filter: 'blur(60px)',
            opacity: 0.25,
            zIndex: 0
          }} />
          <p style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '10px',
          }}>Admin</p>
          <h1 style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '36px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            position: 'relative',
            zIndex: 1,
            textShadow: '0 0 15px var(--border-glow)'
          }}>CODE//EXAM</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Faculty Administration Panel
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <input
            id="admin-username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Email Address"
            autoFocus
            style={inputStyle}
          />
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: 'var(--error)', marginBottom: '12px' }}>{error}</p>
        )}

        <button
          id="admin-login-btn"
          onClick={handleLogin}
          disabled={loading || !username || !password}
          style={{
            width: '100%',
            padding: '13px',
            background: loading ? 'var(--surface-2)' : 'var(--accent)',
            border: '1px solid transparent',
            borderRadius: '4px',
            color: loading ? 'var(--text-muted)' : '#000',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: loading ? 'none' : '0 0 15px var(--accent-dim)'
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 0 20px var(--border-glow)';
            }
          }}
          onMouseOut={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 0 15px var(--accent-dim)';
            }
          }}
        >
          {loading ? 'Authenticating...' : 'Login'}
        </button>

        <p style={{ marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Default: kirank / kiran123
        </p>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '24px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontFamily: 'JetBrains Mono, monospace'
      }}>
        <p>Built for secure, standardized coding assessments.</p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.15s ease',
};
