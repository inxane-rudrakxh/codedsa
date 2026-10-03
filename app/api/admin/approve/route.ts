import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { session_id, action } = body;

  if (!session_id || !action) {
    return NextResponse.json({ error: 'Missing session_id or action' }, { status: 400 });
  }

  try {
    if (action === 'approve') {
      await prisma.examSession.updateMany({
        where: { id: session_id, status: 'PENDING_APPROVAL' },
        data: { status: 'ACTIVE', start_time: new Date() }
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'reject') {
      await prisma.examSession.deleteMany({
        where: { id: session_id, status: 'PENDING_APPROVAL' }
      });
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
