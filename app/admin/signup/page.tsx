'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    department: '',
    subject: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') {
      return 'This email address is already registered. Please sign in instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters long.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection issue. Please check your internet connection.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many requests. Please wait a moment and try again.';
    }
    return err?.message?.replace(/^Firebase:\s*/i, '') || 'Registration failed. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = formData.email.trim().toLowerCase();
    const isAllowedDomain = cleanEmail.endsWith('@zealeducation.com') || cleanEmail.endsWith('@zcoer.edu.in');
    if (!isAllowedDomain) {
      setError('Please use your official college email (@zealeducation.com or @zcoer.edu.in).');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      let firebaseToken = '';

      // Try Firebase authentication flow
      try {
        const { auth } = await import('@/lib/firebase');
        const { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } = await import('firebase/auth');

        try {
          // 1. Create user in Firebase
          const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, formData.password);
          
          // 2. Send Verification Email
          try {
            await sendEmailVerification(userCredential.user);
          } catch (emailErr) {
            console.warn('Email verification dispatch notice:', emailErr);
          }

          // 3. Get Firebase Token
          firebaseToken = await userCredential.user.getIdToken();
        } catch (fbCreateErr: any) {
          if (fbCreateErr.code === 'auth/email-already-in-use') {
            // Already created in Firebase, attempt sign-in to retrieve token and verify DB record
            try {
              const signinCredential = await signInWithEmailAndPassword(auth, cleanEmail, formData.password);
              firebaseToken = await signinCredential.user.getIdToken();
            } catch (signinErr: any) {
              throw new Error('This email address is already registered in Firebase. If this is your account, please proceed to Sign In.');
            }
          } else {
            throw fbCreateErr;
          }
        }
      } catch (fbModuleErr: any) {
        console.warn('Firebase client sign-up warning:', fbModuleErr);
        // If Firebase threw an explicit already-registered error, propagate it
        if (fbModuleErr.message && fbModuleErr.message.includes('already registered')) {
          throw fbModuleErr;
        }
        // Otherwise continue with backend creation
      }

      // 4. Send to backend to create or verify DB record
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: cleanEmail,
          firebaseToken: firebaseToken || undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed on server.');
      }

      setSuccess(true);
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
      <div className="animate-fade-up glass-panel" style={{ maxWidth: '420px', width: '100%', padding: '40px 32px' }}>
        <div style={{ marginBottom: '32px' }}>
          <p className="text-label" style={{ marginBottom: '10px' }}>Faculty Portal</p>
          <h1 style={{
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>CREATE ACCOUNT</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Register as a teacher to create and supervise exams.
          </p>
        </div>

        {success ? (
          <div style={{
            background: 'rgba(93, 184, 114, 0.1)',
            border: '1px solid #5db872',
            borderRadius: '8px',
            padding: '24px 20px',
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>✓</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#5db872', marginBottom: '8px' }}>
              Registration Successful!
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
              Your faculty account has been registered for <strong style={{ color: 'var(--text-primary)' }}>{formData.email}</strong>. If a verification link was sent, please check your inbox (and spam folder) before logging in.
            </p>
            <button
              onClick={() => router.push('/admin/login')}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                fontFamily: 'Söhne Mono, ui-monospace, monospace',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              Proceed to Sign In
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ 
                background: 'var(--error-dim)', 
                border: '1px solid var(--error)', 
                color: 'var(--error)', 
                padding: '12px', 
                borderRadius: '4px', 
                marginBottom: '24px',
                fontSize: '13px',
                lineHeight: 1.5
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Full Name *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '12px 16px',
                    color: 'var(--text-primary)',
                    fontFamily: 'Söhne Mono, ui-monospace, monospace',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div>
                <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  pattern=".*@(zealeducation\.com|zcoer\.edu\.in)$"
                  title="Email must end with @zealeducation.com or @zcoer.edu.in"
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '12px 16px',
                    color: 'var(--text-primary)',
                    fontFamily: 'Söhne Mono, ui-monospace, monospace',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Supported domains: @zealeducation.com, @zcoer.edu.in
                </span>
              </div>

              <div>
                <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  minLength={6}
                  required
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '12px 16px',
                    color: 'var(--text-primary)',
                    fontFamily: 'Söhne Mono, ui-monospace, monospace',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Department</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    disabled={loading}
                    style={{
                      width: '100%',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '12px 16px',
                      color: 'var(--text-primary)',
                      fontFamily: 'Söhne Mono, ui-monospace, monospace',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Subject</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    disabled={loading}
                    style={{
                      width: '100%',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '12px 16px',
                      color: 'var(--text-primary)',
                      fontFamily: 'Söhne Mono, ui-monospace, monospace',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '16px',
                  width: '100%',
                  padding: '14px 24px',
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  fontFamily: 'Söhne Mono, ui-monospace, monospace',
                  fontSize: '14px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  if (!loading) e.currentTarget.style.background = 'var(--accent-hover)';
                }}
                onMouseOut={(e) => {
                  if (!loading) e.currentTarget.style.background = 'var(--accent)';
                }}
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Already have an account?{' '}
                <Link href="/admin/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  Sign In
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
