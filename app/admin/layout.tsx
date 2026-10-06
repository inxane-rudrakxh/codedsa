'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [userInfo, setUserInfo] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    if (pathname === '/admin/login' || pathname === '/admin/signup') { setChecking(false); return; }
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    
    // Decode token to get user info (JWT is base64)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(atob(parts[1]));
        setUserInfo({ name: decoded.email || 'User', role: decoded.role || 'TEACHER' });
      }
    } catch {}
    setChecking(false);
  }, [pathname, router]);

  if (pathname === '/admin/login' || pathname === '/admin/signup') return <>{children}</>;
  if (checking) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontSize: '13px' }}>Verifying...</p>
    </div>
  );

  const isAdmin = userInfo?.role === 'ADMIN';

  const nav = [
    { href: '/admin/dashboard', label: 'Dashboard', showFor: 'all' },
    { href: '/admin/questions', label: 'Questions', showFor: 'all' },
    { href: '/admin/tests', label: 'Tests', showFor: 'all' },
    { href: '/admin/results', label: 'Results', showFor: 'all' },
    { href: '/admin/students', label: 'Students', showFor: 'all' },
    { href: '/admin/teachers', label: 'Teachers', showFor: 'admin' },
    { href: '/admin/settings', label: 'Settings', showFor: 'admin' },
  ].filter(item => item.showFor === 'all' || isAdmin);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        height: '52px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '24px',
        background: 'var(--surface-1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'fit-content' }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
          }}>CODE//ZEAL</span>
          {userInfo && (
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: isAdmin ? 'var(--accent)' : 'var(--warning, #f0a500)',
              background: isAdmin ? 'var(--accent-dim)' : 'rgba(240,165,0,0.12)',
              padding: '2px 7px',
              borderRadius: '2px',
              textTransform: 'uppercase',
            }}>
              {userInfo.role}
            </span>
          )}
        </div>

        <div style={{ height: '16px', width: '1px', background: 'var(--border)' }} />

        <nav style={{ display: 'flex', gap: '2px' }}>
          {nav.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: active ? 'var(--surface-2)' : 'transparent',
                borderRadius: '3px',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                letterSpacing: '0.02em',
              }}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {userInfo && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {userInfo.name}
            </span>
          )}
          <button
            onClick={() => {
              localStorage.removeItem('admin_token');
              router.push('/admin/login');
            }}
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              cursor: 'pointer',
              padding: '4px 10px',
              letterSpacing: '0.04em',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '32px' }}>
        {children}
      </main>
    </div>
  );
}
