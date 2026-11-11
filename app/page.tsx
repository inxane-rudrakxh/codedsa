'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Code2,
  Terminal,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Zap,
  AlertCircle,
  GraduationCap
} from 'lucide-react';

interface Developer {
  name: string;
  role: string;
  bio: string;
  initials: string;
  stack: string[];
}

const developers: Developer[] = [
  {
    name: 'Rudraksh Kottalwar',
    role: 'Lead Architect',
    bio: 'Engineered the sandbox runner microservices, Next.js architecture, and core grading engine.',
    initials: 'RK',
    stack: ['Next.js 16', 'TypeScript', 'Docker'],
  },
  {
    name: 'Kapil Hingole',
    role: 'Backend & Database',
    bio: 'Designed MongoDB Atlas schemas, Prisma data models, and exam session state machines.',
    initials: 'KH',
    stack: ['MongoDB', 'Prisma ORM', 'JWT'],
  },
  {
    name: 'Sagar Rajput',
    role: 'Frontend & Workspace',
    bio: 'Built the Monaco code editor workspace, responsive layout systems, and student exam UI.',
    initials: 'SR',
    stack: ['React 19', 'Monaco Editor', 'Tailwind'],
  },
  {
    name: 'Kapil Patil',
    role: 'DevOps & Reliability',
    bio: 'Implemented DSA puzzle grading algorithms, anti-cheat audit logs, and runtime stability.',
    initials: 'KP',
    stack: ['Piston Engine', 'Linux IPC', 'Jest'],
  },
];

const features = [
  {
    icon: Terminal,
    title: 'Multi-Language Sandbox',
    desc: 'Runs C++, Java, Python, and JavaScript in secure, low-latency containerized runtimes with custom I/O test cases.',
  },
  {
    icon: Sparkles,
    title: 'DSA Conceptual Puzzles',
    desc: 'Dedicated engine for linked list pointer manipulation, recursion tracing, and short-answer auto-grading.',
  },
  {
    icon: ShieldCheck,
    title: 'Proctored Integrity',
    desc: 'Enforces fullscreen locking, detects tab switches and focus loss, with automated audit logs.',
  },
  {
    icon: Zap,
    title: 'Instant Evaluation',
    desc: 'Real-time grading against master solutions with instant score publishing for students and faculty.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [testCode, setTestCode] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'output'>('code');

  // Secret Admin Shortcut: Select only the 'A' in 'DSA' and press Ctrl + Shift + X
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        const selection = typeof window !== 'undefined' ? window.getSelection() : null;
        if (!selection) return;

        const selectedText = selection.toString().trim();
        if (selectedText !== 'A') return;

        const targetSpan = document.getElementById('secret-dsa-a');
        if (!targetSpan) return;

        // Verify the selection is specifically the 'A' in DSA, not any other 'A'
        const isDsaA = Boolean(
          (selection.containsNode && selection.containsNode(targetSpan, true)) ||
          (selection.anchorNode && targetSpan.contains(selection.anchorNode)) ||
          (selection.focusNode && targetSpan.contains(selection.focusNode))
        );

        if (isDsaA) {
          e.preventDefault();
          router.push('/secret-12450/login');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const handleLaunchTest = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = testCode.trim();
    if (!trimmed) {
      setError('Please enter an assessment code.');
      return;
    }
    setError('');

    let slug = trimmed;
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        slug = url.pathname.replace(/^\/+/, '');
      }
    } catch {}

    router.push(`/${encodeURIComponent(slug)}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    }}>
      {/* Navbar - Full Width */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        width: '100%',
      }}>
        <div style={{
          width: '100%',
          padding: '0 32px',
          height: '62px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <Code2 size={18} />
            </div>
            <span style={{
              fontFamily: 'Söhne Mono, ui-monospace, monospace',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}>
              CODE//ZEAL
            </span>
          </div>

          {/* Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a href="#features" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>Features</a>
            <a href="#team" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>Team</a>
            <button
              onClick={() => {
                const el = document.getElementById('assessment-input');
                el?.focus();
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              style={{
                padding: '7px 15px',
                fontSize: '12.5px',
                fontWeight: 600,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Enter Test
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section - Full Width */}
      <section style={{
        width: '100%',
        padding: '52px 32px 60px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '40px',
        alignItems: 'center',
      }}>
        {/* Left: Headline & Test Launcher */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Söhne Mono, monospace',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Department of AI &amp; Data Science &bull; ZCOER
            </span>
            <h1 style={{
              fontSize: 'clamp(2.2rem, 3.5vw, 3.2rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              marginTop: '8px',
              marginBottom: '14px',
            }}>
              Coding &amp; DS<span id="secret-dsa-a">A</span> Examination Engine.
            </h1>
            <p style={{
              fontSize: '15px',
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
              textAlign: 'justify',
            }}>
              A secure, automated assessment platform supporting live code execution, data structure pointer puzzles, and proctored testing.
            </p>
          </div>

          {/* Test Input Form */}
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '20px',
            width: '100%',
          }}>
            <form onSubmit={handleLaunchTest} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                id="assessment-input"
                type="text"
                value={testCode}
                onChange={(e) => {
                  setTestCode(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter test code (e.g. unit-3-linked-lists)"
                style={{
                  flex: '1 1 240px',
                  padding: '11px 14px',
                  fontSize: '13.5px',
                  fontFamily: 'Söhne Mono, monospace',
                  background: 'var(--bg)',
                  border: error ? '1px solid var(--error)' : '1px solid var(--border)',
                  borderRadius: '5px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '11px 20px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>Launch</span>
                <ArrowRight size={14} />
              </button>
            </form>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--error)', marginTop: '8px' }}>
                <AlertCircle size={13} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '14px', marginTop: '14px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
              <span>&bull; Fullscreen enforced</span>
              <span>&bull; Anti-cheat active</span>
              <span>&bull; Auto-saving</span>
            </div>
          </div>
        </div>

        {/* Right: Code & Output Terminal Preview */}
        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
          width: '100%',
        }}>
          {/* Window Header */}
          <div style={{
            height: '36px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
          }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setActiveTab('code')}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontFamily: 'Söhne Mono, monospace',
                  background: activeTab === 'code' ? 'var(--surface-1)' : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  color: activeTab === 'code' ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'code' ? 600 : 400,
                }}
              >
                solution.cpp
              </button>
              <button
                onClick={() => setActiveTab('output')}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontFamily: 'Söhne Mono, monospace',
                  background: activeTab === 'output' ? 'var(--surface-1)' : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  color: activeTab === 'output' ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'output' ? 600 : 400,
                }}
              >
                test_output
              </button>
            </div>

            <span style={{ fontSize: '10.5px', fontFamily: 'Söhne Mono, monospace', color: 'var(--success)' }}>
              RUNNER ACTIVE
            </span>
          </div>

          {/* Window Body */}
          <div style={{
            padding: '16px 18px',
            fontFamily: 'Söhne Mono, monospace',
            fontSize: '12px',
            lineHeight: 1.65,
            background: 'var(--bg)',
            minHeight: '220px',
          }}>
            {activeTab === 'code' ? (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>// Q: Connect node 20 to node 30</span><br />
                <span style={{ color: 'var(--accent)' }}>void</span> <span style={{ color: '#059669' }}>linkNodes</span>(Node* temp, Node* n1) &#123;<br />
                &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: '3px', color: 'var(--accent)', fontWeight: 600 }}>temp-&gt;next = n1;</span><br />
                &#125;
              </div>
            ) : (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>$ runner execute --lang cpp</span><br />
                <span style={{ color: 'var(--success)' }}>[PASS]</span> Testcase 1 (Pointer rewire): OK (8ms)<br />
                <span style={{ color: 'var(--success)' }}>[PASS]</span> Testcase 2 (Traversal verification): OK (11ms)<br /><br />
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Score: 30 / 30 &bull; ALL TESTS PASSED</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Strip - Full Width */}
      <section id="features" style={{
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '52px 32px',
        width: '100%',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          width: '100%',
        }}>
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  background: 'var(--surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}>
                  <Icon size={16} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, textAlign: 'justify' }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Team Section: Faculty Guide + Student Developers - Full Width */}
      <section id="team" style={{
        width: '100%',
        padding: '60px 32px 72px',
      }}>
        <div style={{ marginBottom: '28px' }}>
          <span style={{
            fontSize: '11.5px',
            fontWeight: 700,
            fontFamily: 'Söhne Mono, monospace',
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            Mentorship &amp; Engineering
          </span>
          <h2 style={{
            fontSize: 'clamp(1.8rem, 2.5vw, 2.3rem)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginTop: '4px',
          }}>
            Project Mentorship &amp; Team
          </h2>
        </div>

        {/* Faculty Guide Spotlight Card */}
        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          width: '100%',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              fontFamily: 'Söhne Mono, monospace',
              fontWeight: 700,
              fontSize: '15px',
            }}>
              <GraduationCap size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Prof. Kiran Kalokhe
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'Söhne Mono, monospace',
                  color: 'var(--accent)',
                  background: 'var(--surface-2)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                }}>
                  PROJECT GUIDE &amp; MENTOR
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5, textAlign: 'justify' }}>
                Conceptualized the project vision, designed the curriculum-aligned DSA puzzle format, and mentored the student engineering team.
              </p>
            </div>
          </div>

          <span style={{
            fontSize: '12px',
            fontFamily: 'Söhne Mono, monospace',
            color: 'var(--text-muted)',
          }}>
            Faculty &bull; Dept of AI &amp; DS
          </span>
        </div>

        {/* 4 Student Developer Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          width: '100%',
        }}>
          {developers.map((dev, idx) => (
            <div key={idx} style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '6px',
                    background: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'Söhne Mono, monospace',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    color: 'var(--accent)',
                  }}>
                    {dev.initials}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {dev.name}
                    </h3>
                    <div style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'Söhne Mono, monospace' }}>
                      {dev.role}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, textAlign: 'justify' }}>
                  {dev.bio}
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                {dev.stack.map((s, si) => (
                  <span key={si} style={{
                    fontSize: '10px',
                    fontFamily: 'Söhne Mono, monospace',
                    padding: '2px 6px',
                    background: 'var(--bg)',
                    borderRadius: '3px',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Clean Footer - Full Width */}
      <footer style={{
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border)',
        padding: '24px 32px',
        marginTop: 'auto',
        width: '100%',
      }}>
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          <div>
            <strong>CODE//ZEAL</strong> &bull; Conceived by Prof. Kiran Kalokhe &bull; Built by Rudraksh Kottalwar, Kapil Hingole, Sagar Rajput, Kapil Patil
          </div>
          <div style={{ fontFamily: 'Söhne Mono, monospace' }}>
            &copy; {new Date().getFullYear()} ZCOER AI&amp;DS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
