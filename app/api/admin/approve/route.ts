import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { session_id, action } = body;

  if (!session_id || !action) {
    return NextResponse.json({ error: 'Missing session_id or action' }, { status: 400 });
  }

  try {
    // Verify the session belongs to a test this user can manage
    const session = await prisma.examSession.findUnique({
      where: { id: session_id },
      include: { test: true }
    });
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Teacher can only approve sessions for their own tests
    if (payload.role === 'TEACHER' && session.test.teacher_id !== payload.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (action === 'approve') {
      await prisma.examSession.update({
        where: { id: session_id },
        data: { status: 'ACTIVE', start_time: new Date() }
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'approve_all') {
      const scope = payload.role === 'TEACHER' ? { test: { teacher_id: payload.user_id } } : {};
      await prisma.examSession.updateMany({
        where: { status: 'PENDING_APPROVAL', ...scope },
        data: { status: 'ACTIVE', start_time: new Date() }
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'reject') {
      await prisma.examSession.delete({ where: { id: session_id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'force_submit') {
      await prisma.examSession.update({
        where: { id: session_id },
        data: { status: 'COMPLETED', is_submitted: true, end_time: new Date() }
      });
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
