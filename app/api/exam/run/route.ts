import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';
import { compileAndRun } from '@/lib/executor';
import { checkRateLimit } from '@/lib/rateLimiter';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  // Rate limit code execution to 20 requests per minute per session
  const rateKey = `run:${payload.session_id}`;
  const rateCheck = checkRateLimit(rateKey, 20, 60 * 1000);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Please wait a moment before running code again.' }, { status: 429 });
  }

  const body = await request.json();
  const { code, language, input, question_id } = body;

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'code must be a non-empty string' }, { status: 400 });
  }

  if (code.length > 65536) {
    return NextResponse.json({ error: 'Code size exceeds maximum limit of 64KB' }, { status: 400 });
  }

  if (input && (typeof input !== 'string' || input.length > 16384)) {
    return NextResponse.json({ error: 'Custom input exceeds maximum limit of 16KB' }, { status: 400 });
  }

  // Verify session is active
  const session = await prisma.examSession.findUnique({ where: { id: payload.session_id } });
  if (!session || session.status === 'EXPIRED' || session.is_submitted) {
    return NextResponse.json({ error: 'Exam session is not active' }, { status: 403 });
  }

  let timeLimit = 1.0;
  let memoryLimit = 256000;

  if (question_id) {
    const question = await prisma.question.findUnique({ where: { id: question_id } });
    if (question) {
      // For "Run Code" (not submission judging), use a generous 10s so interactive
      // programs with multiple cin reads don't time out while the student is testing.
      timeLimit = Math.max(question.time_limit || 1.0, 10.0);
      memoryLimit = question.memory_limit || 256000;
    }
  } else {
    // No question context — still allow 10s for free-run
    timeLimit = 10.0;
  }

  const result = await compileAndRun(code, input || '', language || 'cpp', timeLimit, memoryLimit);

  return NextResponse.json({
    success: result.success,
    output: result.timed_out ? `Time Limit Exceeded (${timeLimit}s)` : (result.output || ''),
    stderr: result.stderr || '',
    compile_error: result.compile_error || null,
    execution_time: result.execution_time || 0,
    timed_out: result.timed_out || false,
  });
}
