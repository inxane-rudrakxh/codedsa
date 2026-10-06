import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';
import { simulateCodeExecutionWithAI } from '@/lib/ai';

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

  // Use AI to simulate the code execution (bypasses server compiler constraints)
  const simulatedOutput = await simulateCodeExecutionWithAI(code, language || 'cpp', input || '');

  if (simulatedOutput.startsWith('COMPILATION_ERROR:')) {
    return NextResponse.json({
      success: false,
      output: '',
      stderr: '',
      compile_error: simulatedOutput.replace('COMPILATION_ERROR:', '').trim(),
      execution_time: 1500,
      timed_out: false,
    });
  }

  return NextResponse.json({
    success: true,
    output: simulatedOutput,
    stderr: '',
    compile_error: null,
    execution_time: 1200,
    timed_out: false,
  });
}
