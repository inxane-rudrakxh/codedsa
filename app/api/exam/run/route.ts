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
  const { code, language, input } = body;

  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  // Verify session is active
  const session = await prisma.examSession.findUnique({ where: { id: payload.session_id } });
  if (!session || session.status === 'EXPIRED') {
    return NextResponse.json({ error: 'Exam session is not active' }, { status: 403 });
  }

  // Free compiler — just run the code with provided custom input, like Programiz
  // Student provides their own input via the custom input box
  const result = await compileAndRun(code, input || '', language || 'cpp');

  return NextResponse.json({
    success: result.success,
    output: result.timed_out ? 'Time Limit Exceeded (5s)' : (result.output || ''),
    stderr: result.stderr || '',
    compile_error: result.compile_error || null,
    execution_time: result.execution_time || 0,
    timed_out: result.timed_out || false,
  });
}
