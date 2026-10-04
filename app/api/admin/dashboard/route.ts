import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser, teacherScope } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = teacherScope(payload);

  // Get tests visible to this user
  const tests = await prisma.test.findMany({
    where: scope ? { teacher_id: scope } : {},
    include: {
      subject: true,
      _count: { select: { examSessions: true } }
    },
    orderBy: { created_at: 'desc' }
  });

  const testIds = tests.map(t => t.id);

  const total_students = await prisma.student.count({ where: { user: { status: 'ACTIVE' } } });
  const total_tests = tests.length;
  const published_tests = tests.filter(t => t.status === 'PUBLISHED').length;

  // Sessions only for this teacher's tests
  const sessions = await prisma.examSession.findMany({
    where: testIds.length > 0 ? { test_id: { in: testIds } } : { id: 'no-match' },
    include: {
      student: { include: { user: true, division: true } },
      test: { include: { subject: true } },
      _count: { select: { submissions: true } }
    },
    orderBy: { created_at: 'desc' },
    take: 100
  });

  const durationMap: Record<string, number> = {};
  tests.forEach(t => { durationMap[t.id] = t.duration_minutes; });

  const activeSessions = [];
  let pending_requests = 0;

  for (const session of sessions) {
    if (session.status === 'PENDING_APPROVAL') pending_requests++;

    const durationMinutes = durationMap[session.test_id] || 60;
    const elapsed = (Date.now() - new Date(session.start_time).getTime()) / 1000;
    const remaining = Math.max(0, durationMinutes * 60 - elapsed);

    let displayStatus: string;
    if (session.status === 'PENDING_APPROVAL') displayStatus = 'pending_approval';
    else if (session.is_submitted) displayStatus = 'submitted';
    else if (remaining <= 0) displayStatus = 'expired';
    else displayStatus = 'active';

    activeSessions.push({
      session_id: session.id,
      roll_no: session.student.roll_number,
      name: session.student.user.full_name,
      division: session.student.division?.name || '',
      test_title: session.test.title,
      subject: session.test.subject.name,
      status: displayStatus,
      remaining_seconds: Math.floor(remaining),
      integrity_warnings: session.integrity_warnings,
      submitted_count: session._count.submissions,
    });
  }

  const started = new Set(sessions.map(s => s.student_id)).size;
  const submitted = sessions.filter(s => s.is_submitted).length;

  return NextResponse.json({
    total_students,
    total_tests,
    published_tests,
    started,
    submitted,
    pending_requests,
    active_sessions: activeSessions,
    tests_summary: tests.map(t => ({
      id: t.id,
      title: t.title,
      subject: t.subject.name,
      status: t.status,
      marks_published: t.marks_published,
      session_count: t._count.examSessions,
    })),
    role: payload.role,
  });
}
