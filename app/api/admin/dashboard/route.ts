import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const payload = await verifyAuthToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Invalid or unauthorized token' }, { status: 401 });
  }

  const total_students = await prisma.student.count();
  
  const allSessions = await prisma.examSession.findMany({ select: { student_id: true, is_submitted: true } });
  const startedIds = new Set(allSessions.map(s => s.student_id));
  const started = startedIds.size;
  const submittedIds = new Set(allSessions.filter(s => s.is_submitted).map(s => s.student_id));
  const submitted = submittedIds.size;

  const testInfo = await prisma.test.findUnique({ where: { id: 1 } });
  const durationMinutes = testInfo?.duration_minutes || 60;

  const sessions = await prisma.examSession.findMany({
    include: {
      student: { include: { user: true, division: true } },
      _count: { select: { submissions: true } }
    },
    orderBy: { start_time: 'desc' },
    take: 50
  });

  const activeSessions = [];
  let pending_requests = 0;

  for (const session of sessions) {
    if (session.status === 'PENDING_APPROVAL') {
      pending_requests++;
    }

    const elapsed = (Date.now() - new Date(session.start_time).getTime()) / 1000;
    const remaining = Math.max(0, durationMinutes * 60 - elapsed);
    const submittedCount = session._count.submissions;

    activeSessions.push({
      session_id: session.id,
      roll_no: session.student.roll_number,
      name: session.student.user.full_name,
      division: session.student.division?.name || 'A',
      status: session.status === 'PENDING_APPROVAL' ? 'pending_approval' : (session.is_submitted ? 'submitted' : (remaining <= 0 ? 'expired' : 'active')),
      remaining_seconds: Math.floor(remaining),
      integrity_warnings: session.integrity_warnings,
      submitted_count: submittedCount,
    });
  }

  return NextResponse.json({
    total_students,
    started,
    submitted,
    pending_requests,
    active_sessions: activeSessions,
  });
}
