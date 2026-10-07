'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      
      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
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
            Register as a teacher to create exams.
          </p>
        </div>

        {error && (
          <div style={{ 
            background: 'var(--error-dim)', 
            border: '1px solid var(--error)', 
            color: 'var(--error)', 
            padding: '12px', 
            borderRadius: '4px', 
            marginBottom: '24px',
            fontSize: '13px'
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
              placeholder="Dr. John Doe"
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
              placeholder="faculty@zealeducation.com"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              required
              pattern=".*@zealeducation\.com$"
              title="Email must end with @zealeducation.com"
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
            <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Password *</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
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
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label className="text-label" style={{ display: 'block', marginBottom: '8px' }}>Department</label>
              <input
                type="text"
                name="department"
                placeholder="e.g. AI&DS"
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
                placeholder="e.g. DSA"
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
      </div>
    </main>
  );
}
