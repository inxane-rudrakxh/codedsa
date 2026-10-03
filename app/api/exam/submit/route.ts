import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';
import { compileAndRun, compareOutputs, checkCodeLogic } from '@/lib/executor';
import { evaluateCodeWithAI } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { question_id, code } = body;

  if (!question_id || !code) {
    return NextResponse.json({ error: 'question_id and code are required' }, { status: 400 });
  }

  // Check session
  const session = await prisma.examSession.findUnique({ where: { id: payload.session_id } });
  if (!session || session.status === 'EXPIRED') {
    return NextResponse.json({ error: 'Session not active' }, { status: 403 });
  }

  // Check not already submitted
  const existing = await prisma.submission.findFirst({
    where: { session_id: payload.session_id, question_id }
  });
  if (existing) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
  }

  // Verify assignment
  const assigned = await prisma.assignedQuestion.findUnique({
    where: { session_id_question_id: { session_id: payload.session_id, question_id } }
  });
  if (!assigned) return NextResponse.json({ error: 'Not assigned' }, { status: 403 });

  const question = await prisma.question.findUnique({ where: { id: parseInt(question_id) } });
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  // Algorithmic / structural check
  const logicCheck = checkCodeLogic(code, parseInt(question_id));
  if (!logicCheck.valid) {
    return NextResponse.json({
      success: false,
      compile_error: logicCheck.reason,
      passed_cases: 0,
      total_cases: 0,
      score: 0,
      max_score: question.marks,
    });
  }

  // Get ALL test cases
  const testCases = await prisma.testCase.findMany({
    where: { question_id: parseInt(question_id) }
  });

  if (!testCases || testCases.length === 0) {
    return NextResponse.json({ error: 'No test cases' }, { status: 404 });
  }

  // Run code against all test cases
  const results = [];
  let compileError: string | undefined;
  let compiledOk = true;
  let totalExecTime = 0;

  for (const tc of testCases) {
    const result = await compileAndRun(code, tc.input);

    if (!result.success && result.compile_error && !result.timed_out) {
      compileError = result.compile_error;
      compiledOk = false;
      break;
    }

    const passed = result.success && compareOutputs(result.output || '', tc.expected_output);
    results.push({
      test_case_id: tc.id,
      passed,
      actual_output: result.timed_out ? 'TLE' : (result.output || ''),
      execution_time: result.execution_time || 0,
    });
    totalExecTime += result.execution_time || 0;
  }

  const passedCases = results.filter(r => r.passed).length;
  const passRate = testCases.length > 0 ? passedCases / testCases.length : 0;
  
  let marks = 0;
  let subStatus = 'COMPILATION_ERROR';

  if (compiledOk) {
    marks = passRate * question.marks;
    if (passRate === 1) subStatus = 'ACCEPTED';
    else if (passRate > 0) subStatus = 'PARTIAL_ACCEPTED';
    else subStatus = 'WRONG_ANSWER';
  }

  // --- AI EVALUATION (Overrides baseline marks if available) ---
  let aiFeedback = null;
  if (compiledOk) {
    const aiResult = await evaluateCodeWithAI(
      question.title,
      question.description || '', // or statement
      code,
      passedCases,
      testCases.length,
      question.marks
    );

    if (aiResult) {
      marks = aiResult.score;
      aiFeedback = aiResult.feedback;
    }
  }

  // Save submission
  const submission = await prisma.submission.create({
    data: {
      session_id: payload.session_id,
      question_id: parseInt(question_id),
      language_id: 1,
      source_code: code,
      status: subStatus,
      total_test_cases: testCases.length,
      passed_test_cases: passedCases,
      execution_time_ms: compiledOk ? totalExecTime : null,
      error_message: compileError || aiFeedback,
      marks_awarded: marks,
      submissionResults: compiledOk && results.length > 0 ? {
        create: results.map(r => ({
          test_case_id: r.test_case_id,
          status: r.passed ? 'ACCEPTED' : 'WRONG_ANSWER',
          execution_time_ms: r.execution_time,
          actual_output: r.actual_output,
        }))
      } : undefined
    }
  });

  // Auto-save final code
  await prisma.codeDraft.upsert({
    where: { session_id_question_id: { session_id: payload.session_id, question_id: parseInt(question_id) } },
    update: { source_code: code, updated_at: new Date() },
    create: { session_id: payload.session_id, question_id: parseInt(question_id), language_id: 1, source_code: code }
  });

  // Check if all questions submitted
  const submittedCount = await prisma.submission.count({ where: { session_id: payload.session_id } });
  const assignedCount = await prisma.assignedQuestion.count({ where: { session_id: payload.session_id } });

  if (submittedCount >= assignedCount && assignedCount > 0) {
    await prisma.examSession.update({
      where: { id: payload.session_id },
      data: { status: 'COMPLETED', is_submitted: true, end_time: new Date() }
    });
  }

  const showScores = await prisma.setting.findUnique({ where: { key: 'show_scores_immediately' } });

  return NextResponse.json({
    success: true,
    submission_id: submission.id,
    score: showScores?.value !== '0' ? marks : null,
    max_score: question.marks,
    compile_error: compiledOk ? null : compileError,
    passed_cases: passedCases,
    total_cases: testCases.length,
    all_submitted: submittedCount >= assignedCount && assignedCount > 0,
  });
}
