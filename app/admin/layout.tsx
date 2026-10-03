'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (pathname === '/admin/login') { setChecking(false); return; }
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    setChecking(false);
  }, [pathname, router]);

  if (pathname === '/admin/login') return <>{children}</>;
  if (checking) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontSize: '13px' }}>Verifying...</p>
    </div>
  );

  const nav = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/branches', label: 'Branches' },
    { href: '/admin/subjects', label: 'Subjects' },
    { href: '/admin/students', label: 'Students' },
    { href: '/admin/teachers', label: 'Teachers' },
    { href: '/admin/questions', label: 'Questions' },
    { href: '/admin/tests', label: 'Tests' },
    { href: '/admin/results', label: 'Results' },
    { href: '/admin/settings', label: 'Settings' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <header style={{
        height: '52px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        gap: '32px',
        background: 'var(--surface-1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.04em',
          minWidth: 'fit-content',
        }}>ZCOER PLATFORM</span>

        <div style={{ height: '16px', width: '1px', background: 'var(--border)' }} />

        <nav style={{ display: 'flex', gap: '4px' }}>
          {nav.map(({ href, label }) => {
            const active = pathname === href;
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
          <span className="text-label">Admin</span>
          <button
            onClick={() => {
              localStorage.removeItem('admin_token');
              router.push('/admin/login');
            }}
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
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
