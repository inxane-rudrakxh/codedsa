'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [userInfo, setUserInfo] = useState<{ name: string; role: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (pathname === '/secret-12450/login' || pathname === '/secret-12450/signup') {
      setTimeout(() => setChecking(false), 0);
      return;
    }
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.push('/secret-12450/login');
      return;
    }
    
    let user: { name: string; role: string } | null = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const decoded = JSON.parse(atob(parts[1]));
        user = { name: decoded.email || 'User', role: decoded.role || 'ADMIN' };
      }
    } catch {}

    setTimeout(() => {
      if (user) setUserInfo(user);
      setChecking(false);
    }, 0);
  }, [pathname, router]);

  if (pathname === '/secret-12450/login' || pathname === '/secret-12450/signup') return <>{children}</>;
  if (checking) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', color: 'var(--text-muted)', fontSize: '13px' }}>Verifying...</p>
    </div>
  );

  const isResultsPage = pathname.includes('/results');

  const isAdmin = userInfo?.role === 'ADMIN';

  const nav = [
    { href: '/secret-12450/dashboard', label: 'Overview' },
    { href: '/secret-12450/tests', label: 'Exam Tests' },
    { href: '/secret-12450/results', label: 'Evaluation' },
    { href: '/secret-12450/questions', label: 'Question Bank' },
    { href: '/secret-12450/requests', label: 'Requests' },
    { href: '/secret-12450/students', label: 'Students' },
    ...(isAdmin ? [{ href: '/secret-12450/teachers', label: 'Faculty' }] : []),
    { href: '/secret-12450/settings', label: 'Settings' },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setSidebarCollapsed(prev => !prev)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
            title={sidebarCollapsed ? "Expand sidebar navigation" : "Collapse sidebar to expand screen"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
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
                router.push('/secret-12450/login');
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
          width: sidebarCollapsed ? '0px' : '240px',
          minWidth: sidebarCollapsed ? '0px' : '240px',
          borderRight: sidebarCollapsed ? 'none' : '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          padding: sidebarCollapsed ? '0px' : '24px 16px',
          gap: '8px',
          overflow: 'hidden',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: sidebarCollapsed ? 0 : 1,
          pointerEvents: sidebarCollapsed ? 'none' : 'auto',
          whiteSpace: 'nowrap'
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
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', position: 'relative', width: '100%' }}>
          <div style={{
            maxWidth: isResultsPage ? '100%' : '1200px',
            margin: '0 auto',
            padding: isResultsPage ? '28px 32px' : '40px 48px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {children}
          </div>
        </main>
        
      </div>
    </div>
  );
}
