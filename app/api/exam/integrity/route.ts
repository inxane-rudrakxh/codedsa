import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { event_type } = body;

  if (!event_type) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  const session = await prisma.examSession.findUnique({
    where: { id: payload.session_id },
  });
  if (!session || session.status === 'EXPIRED' || session.is_submitted) {
    return NextResponse.json({ error: 'Session not active' }, { status: 403 });
  }

  const newWarningCount = (session.integrity_warnings || 0) + 1;
  const shouldAutoSubmit = newWarningCount >= 3;

  await prisma.examSession.update({
    where: { id: payload.session_id },
    data: {
      integrity_warnings: newWarningCount,
      ...(shouldAutoSubmit ? {
        status: 'COMPLETED',
        is_submitted: true,
        end_time: new Date(),
      } : {})
    },
  });

  return NextResponse.json({
    success: true,
    warning_count: newWarningCount,
    auto_submitted: shouldAutoSubmit,
  });
}
