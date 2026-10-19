import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { session_id, action } = body;

  if (!action || (action !== 'approve_all' && action !== 'stop_all' && !session_id && (!body.session_ids || body.session_ids.length === 0))) {
    return NextResponse.json({ error: 'Missing session_id or action' }, { status: 400 });
  }

  try {
    const sessionIds: string[] = Array.isArray(body.session_ids)
      ? body.session_ids
      : (session_id ? [session_id] : []);

    // Verify sessions belong to tests this user can manage
    if (sessionIds.length > 0) {
      const sessions = await prisma.examSession.findMany({
        where: { id: { in: sessionIds } },
        include: { test: true }
      });
      if (sessions.length === 0) return NextResponse.json({ error: 'No sessions found' }, { status: 404 });

      // Teacher can only manage sessions for their own tests
      for (const s of sessions) {
        if (payload.role !== 'ADMIN' && s.test.teacher_id !== payload.user_id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    if (action === 'approve') {
      await prisma.examSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: 'ACTIVE', start_time: new Date() }
      });
      return NextResponse.json({ success: true, count: sessionIds.length });
    }

    if (action === 'approve_all') {
      const scope = payload.role === 'TEACHER' ? { test: { teacher_id: payload.user_id } } : {};
      const res = await prisma.examSession.updateMany({
        where: { status: 'PENDING_APPROVAL', ...scope },
        data: { status: 'ACTIVE', start_time: new Date() }
      });
      return NextResponse.json({ success: true, count: res.count });
    }

    if (action === 'reject') {
      await prisma.examSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: 'REJECTED' }
      });
      return NextResponse.json({ success: true, count: sessionIds.length });
    }

    if (action === 'force_submit' || action === 'stop' || action === 'stop_exam') {
      await prisma.examSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: 'STOPPED', is_submitted: true, end_time: new Date() }
      });
      return NextResponse.json({ success: true, count: sessionIds.length });
    }

    if (action === 'stop_all') {
      const { test_id } = body;
      const scope = payload.role === 'TEACHER' ? { teacher_id: payload.user_id } : {};
      const whereClause: any = {
        is_submitted: false,
        status: { in: ['ACTIVE', 'PENDING_APPROVAL'] },
      };
      if (test_id) {
        whereClause.test_id = test_id;
        whereClause.test = scope;
      } else if (payload.role === 'TEACHER') {
        whereClause.test = scope;
      }

      const res = await prisma.examSession.updateMany({
        where: whereClause,
        data: { status: 'STOPPED', is_submitted: true, end_time: new Date() }
      });
      return NextResponse.json({ success: true, count: res.count });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
