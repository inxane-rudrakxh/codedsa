'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResend, setShowResend] = useState(false);

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many failed attempts. Please wait a few moments and try again.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection issue. Please check your internet connection.';
    }
    return err?.message?.replace(/^Firebase:\s*/i, '') || 'Authentication failed. Please try again.';
  };

  const handleResendVerification = async () => {
    if (!username || !password) {
      setError('Please enter your email and password first.');
      return;
    }
    setResending(true);
    setError('');
    setInfo('');
    try {
      const { auth } = await import('@/lib/firebase');
      const { signInWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
      const userCredential = await signInWithEmailAndPassword(auth, username.trim().toLowerCase(), password);
      await sendEmailVerification(userCredential.user);
      setInfo('Verification link resent successfully! Please check your inbox and spam folder.');
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setResending(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    setInfo('');
    setShowResend(false);

    const cleanUsername = username.trim().toLowerCase();

    try {
      let loginSuccess = false;
      let serverErrorMsg = '';

      // Stage 1: Fast-track test admin account
      if (cleanUsername === 'admin@zcoer.edu.in' && password === 'admin123') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanUsername, password, role: 'ADMIN' }),
        });
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('admin_token', data.token);
          router.push('/admin/dashboard');
          return;
        }
      }

      // Stage 2: Attempt Firebase Client Authentication
      let firebaseToken = '';
      let isVerified = false;
      try {
        const { auth } = await import('@/lib/firebase');
        const { signInWithEmailAndPassword } = await import('firebase/auth');

        const userCredential = await signInWithEmailAndPassword(auth, cleanUsername, password);
        isVerified = !!userCredential.user.emailVerified;
        firebaseToken = await userCredential.user.getIdToken();
      } catch (fbErr: any) {
        // Firebase client sign-in failed (e.g. user was created in DB directly by admin, or network issue)
        console.warn('Firebase client login notice, attempting direct database authentication:', fbErr?.code || fbErr?.message);
      }

      // If we have a Firebase token, try submitting with it
      if (firebaseToken) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseToken,
            identifier: cleanUsername,
            password,
            role: 'ADMIN'
          }),
        });
        const data = await res.json();
        if (res.ok && data.token) {
          localStorage.setItem('admin_token', data.token);
          router.push('/admin/dashboard');
          return;
        } else {
          serverErrorMsg = data.error || '';
          if (data.error && data.error.includes('verified')) {
            setShowResend(true);
          }
        }
      }

      // Stage 3: Fallback to direct database credentials authentication
      const directRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanUsername,
          password,
          role: 'ADMIN'
        }),
      });
      const directData = await directRes.json();
      if (directRes.ok && directData.token) {
        localStorage.setItem('admin_token', directData.token);
        router.push('/admin/dashboard');
        return;
      }

      // Both failed: show the most informative error
      if (serverErrorMsg) {
        setError(serverErrorMsg);
      } else {
        setError(directData.error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setError(formatAuthError(err));
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
        <div style={{ marginBottom: '40px' }}>
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
          <div style={{
            background: 'var(--error-dim)',
            border: '1px solid var(--error)',
            borderRadius: '4px',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '12px',
            color: 'var(--error)',
            lineHeight: '1.4'
          }}>
            {error}
          </div>
        )}

        {info && (
          <div style={{
            background: 'rgba(93, 184, 114, 0.12)',
            border: '1px solid #5db872',
            borderRadius: '4px',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '12px',
            color: '#5db872',
            lineHeight: '1.4'
          }}>
            {info}
          </div>
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
            boxShadow: 'none',
            marginBottom: showResend ? '10px' : '0'
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

        {showResend && (
          <button
            onClick={handleResendVerification}
            disabled={resending}
            style={{
              width: '100%',
              padding: '10px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: resending ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {resending ? 'Sending Email...' : 'Resend Verification Email'}
          </button>
        )}

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
