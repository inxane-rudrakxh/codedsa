import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface Branch {
  id: number;
  name: string;
  code: string;
}

export default async function BranchesPage() {
  const branches = await prisma.branch.findMany({ orderBy: { id: 'asc' } });

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Branches</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Manage academic branches and programs</p>
        </div>
        <button style={{
          background: 'var(--accent)',
          color: '#ffffff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer'
        }}>
          + Add Branch
        </button>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>ID</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Code</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Name</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b, i) => (
              <tr key={b.id} style={{ borderBottom: i < branches.length - 1 ? '1px solid var(--border-subtle)' : 'none', background: 'var(--surface-1)' }}>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontFamily: 'Söhne Mono, ui-monospace, monospace', fontSize: '12px', color: 'var(--text-muted)' }}>{b.id}</span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{b.code}</span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{b.name}</span>
                </td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No branches configured</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
