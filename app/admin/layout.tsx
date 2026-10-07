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
    
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(atob(parts[1]));
        setUserInfo({ name: decoded.email || 'User', role: decoded.role || 'ADMIN' });
      }
    } catch {}
    setChecking(false);
  }, [pathname, router]);

  if (pathname === '/admin/login' || pathname === '/admin/signup') return <>{children}</>;
  if (checking) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', color: 'var(--text-muted)', fontSize: '13px' }}>Verifying...</p>
    </div>
  );

  const nav = [
    { href: '/admin/dashboard', label: 'Overview' },
    { href: '/admin/tests', label: 'Tests' },
    { href: '/admin/questions', label: 'Question Bank' },
    { href: '/admin/requests', label: 'Access Requests' },
    { href: '/admin/results', label: 'Results' },
    { href: '/admin/settings', label: 'Settings' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header */}
      <header style={{
        height: '60px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--surface-1)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: 'Söhne Mono, ui-monospace, monospace',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}>
            CODE//ZEAL
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ 
            background: 'var(--surface-2)', 
            border: '1px solid var(--border)', 
            borderRadius: '4px', 
            padding: '4px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '240px'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Search...</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 600
            }}>
              A
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Admin ▾</span>
            <button 
              onClick={() => {
                localStorage.removeItem('admin_token');
                router.push('/admin/login');
              }}
              style={{
                marginLeft: '12px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Sidebar Navigation */}
        <aside style={{
          width: '240px',
          borderRight: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 16px',
          gap: '8px'
        }}>
          {nav.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} style={{
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: active ? 'var(--surface-2)' : 'transparent',
                borderRadius: '6px',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                {label}
                {active && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)' }} />}
              </Link>
            );
          })}
        </aside>

        {/* Page Content */}
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', position: 'relative' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 48px' }}>
            {children}
          </div>
        </main>
        
      </div>
    </div>
  );
}
