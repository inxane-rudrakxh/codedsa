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
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div className="animate-fade-up" style={{ maxWidth: '360px', width: '100%' }}>
        <div style={{ marginBottom: '48px' }}>
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
            fontSize: '32px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>CODE//DSA</h1>
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
            background: loading ? 'var(--surface-2)' : 'var(--text-primary)',
            border: '1px solid transparent',
            borderRadius: '4px',
            color: loading ? 'var(--text-muted)' : 'var(--bg)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
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
        Built by inxanerudrakxh
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
