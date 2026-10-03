import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { question_id, code } = body;

  if (!question_id || code === undefined) {
    return NextResponse.json({ error: 'question_id and code are required' }, { status: 400 });
  }

  // Verify this question belongs to the session
  const assigned = await prisma.assignedQuestion.findUnique({
    where: { session_id_question_id: { session_id: payload.session_id, question_id } }
  });

  if (!assigned) return NextResponse.json({ error: 'Question not assigned to this session' }, { status: 403 });

  // Check session is active
  const session = await prisma.examSession.findUnique({ where: { id: payload.session_id } });
  if (session?.status === 'EXPIRED') {
    return NextResponse.json({ error: 'Exam session is not active' }, { status: 403 });
  }

  // Check question not already submitted
  const submitted = await prisma.submission.findFirst({
    where: { session_id: payload.session_id, question_id }
  });

  if (submitted) {
    return NextResponse.json({ error: 'Question already submitted' }, { status: 403 });
  }

  // Upsert code save
  await prisma.codeDraft.upsert({
    where: { session_id_question_id: { session_id: payload.session_id, question_id } },
    update: { source_code: code, updated_at: new Date() },
    create: { session_id: payload.session_id, question_id, language_id: 1, source_code: code }
  });

  return NextResponse.json({ success: true, saved_at: new Date().toISOString() });
}
