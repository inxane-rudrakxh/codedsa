import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';
import { compileAndRun } from '@/lib/executor';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { code, language, input, question_id } = body;

  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  // Verify session is active
  const session = await prisma.examSession.findUnique({ where: { id: payload.session_id } });
  if (!session || session.status === 'EXPIRED') {
    return NextResponse.json({ error: 'Exam session is not active' }, { status: 403 });
  }

  let timeLimit = 1.0;
  let memoryLimit = 256000;

  if (question_id) {
    const question = await prisma.question.findUnique({ where: { id: question_id } });
    if (question) {
      timeLimit = question.time_limit || 1.0;
      memoryLimit = question.memory_limit || 256000;
    }
  }

  const result = await compileAndRun(code, input || '', language || 'cpp', timeLimit, memoryLimit);

  return NextResponse.json({
    success: result.success,
    output: result.timed_out ? 'Time Limit Exceeded (5s)' : (result.output || ''),
    stderr: result.stderr || '',
    compile_error: result.compile_error || null,
    execution_time: result.execution_time || 0,
    timed_out: result.timed_out || false,
  });
}
