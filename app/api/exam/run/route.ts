import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';
import { compileAndRun, compareOutputs, checkCodeLogic } from '@/lib/executor';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { question_id, code, language } = body;

  if (!question_id || !code) {
    return NextResponse.json({ error: 'question_id and code are required' }, { status: 400 });
  }

  // Verify session is active
  const session = await prisma.examSession.findUnique({ where: { id: payload.session_id } });
  if (!session || session.status === 'EXPIRED') {
    return NextResponse.json({ error: 'Exam session is not active' }, { status: 403 });
  }

  // Verify assignment
  const assigned = await prisma.assignedQuestion.findUnique({
    where: { session_id_question_id: { session_id: payload.session_id, question_id } }
  });

  if (!assigned) return NextResponse.json({ error: 'Question not assigned' }, { status: 403 });

  // Algorithmic / structural check
  const logicCheck = checkCodeLogic(code, question_id);
  if (!logicCheck.valid) {
    return NextResponse.json({
      success: false,
      compile_error: logicCheck.reason,
      test_results: [],
      passed: 0,
      total: 0,
      visible_passed: 0,
      visible_total: 0,
    });
  }

  // Get visible test cases only for run
  const testCases = await prisma.testCase.findMany({
    where: { question_id: question_id, is_hidden: false }
  });

  if (!testCases || testCases.length === 0) {
    return NextResponse.json({ error: 'No test cases found' }, { status: 404 });
  }

  // Compile and run against each test case
  const results = [];
  let compileError: string | undefined;
  let compiledOk = true;

  for (const tc of testCases) {
    const result = await compileAndRun(code, tc.input, language || 'cpp');

    if (!result.success && result.compile_error && !result.timed_out) {
      compileError = result.compile_error;
      compiledOk = false;
      break;
    }
    const passed = result.success && compareOutputs(result.output || '', tc.expected_output);
    results.push({
      test_case_id: tc.id,
      input: tc.input,
      expected_output: tc.expected_output,
      actual_output: result.timed_out ? 'Time Limit Exceeded' : (result.output || result.stderr || ''),
      passed,
      execution_time: result.execution_time || 0,
      is_visible: !tc.is_hidden,
    });
  }

  if (!compiledOk) {
    return NextResponse.json({
      success: false,
      compile_error: compileError,
      test_results: [],
      passed: 0,
      total: testCases.length,
      visible_passed: 0,
      visible_total: testCases.length,
    });
  }

  const passed = results.filter(r => r.passed).length;

  return NextResponse.json({
    success: true,
    test_results: results,
    passed,
    total: results.length,
    visible_passed: passed,
    visible_total: results.length,
  });
}
