'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
      let payload;

      if (username === 'admin@zcoer.edu.in' && password === 'admin123') {
        payload = { identifier: username, password, role: 'ADMIN' };
      } else {
        const { auth } = await import('@/lib/firebase');
        const { signInWithEmailAndPassword } = await import('firebase/auth');

        const userCredential = await signInWithEmailAndPassword(auth, username, password);
        
        if (!userCredential.user.emailVerified) {
          throw new Error('Your email is not verified! Please check your inbox for the verification link.');
        }

        const firebaseToken = await userCredential.user.getIdToken();
        payload = { firebaseToken, role: 'ADMIN' };
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      localStorage.setItem('admin_token', data.token);
      router.push('/admin/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Network error. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--bg-color)',
      backgroundAttachment: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div className="animate-fade-up glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '40px 32px' }}>
        <div style={{ marginBottom: '48px' }}>
          <p style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '10px',
          }}>Faculty</p>
          <h1 style={{
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            fontSize: '36px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>CODE//ZEAL</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Faculty Administration Panel
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <input
            id="admin-username"
            type="email"
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
          <p style={{ fontSize: '12px', color: 'var(--error)', marginBottom: '12px', lineHeight: '1.4' }}>{error}</p>
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
            boxShadow: 'none'
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.currentTarget.style.background = 'var(--accent-hover)';
            }
          }}
          onMouseOut={(e) => {
            if (!loading) {
              e.currentTarget.style.background = 'var(--accent)';
            }
          }}
        >
          {loading ? 'Authenticating...' : 'Login'}
        </button>


        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            New faculty member?{' '}
            <Link href="/admin/signup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Create Account
            </Link>
          </p>
        </div>
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
