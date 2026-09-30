import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyStudentToken } from '@/lib/auth';
import { compileAndRun, compareOutputs, checkCodeLogic } from '@/lib/executor';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { question_id, code } = body;

  if (!question_id || !code) {
    return NextResponse.json({ error: 'question_id and code are required' }, { status: 400 });
  }

  // Verify session is active
  const { data: session } = await supabase.from('exam_sessions').select('status').eq('id', payload.session_id).maybeSingle();
  if (session?.status !== 'active') {
    return NextResponse.json({ error: 'Exam session is not active' }, { status: 403 });
  }

  // Verify assignment
  const { data: assigned } = await supabase.from('assigned_questions')
    .select('session_id')
    .eq('session_id', payload.session_id)
    .eq('question_id', question_id)
    .maybeSingle();

  if (!assigned) return NextResponse.json({ error: 'Question not assigned' }, { status: 403 });

  // Algorithmic / structural check
  const logicCheck = checkCodeLogic(code, parseInt(question_id));
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
  const { data: testCases } = await supabase.from('test_cases')
    .select('*')
    .eq('question_id', question_id)
    .eq('is_visible', 1);

  if (!testCases || testCases.length === 0) {
    return NextResponse.json({ error: 'No test cases found' }, { status: 404 });
  }

  // Compile and run against each test case
  const results = [];
  let compileError: string | undefined;
  let compiledOk = true;

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
      input: tc.input,
      expected_output: tc.expected_output,
      actual_output: result.timed_out ? 'Time Limit Exceeded' : (result.output || result.stderr || ''),
      passed,
      execution_time: result.execution_time || 0,
      type: tc.type,
      is_visible: tc.is_visible,
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
