import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyStudentToken } from '@/lib/auth';
import { compileAndRun, compareOutputs, checkCodeLogic } from '@/lib/executor';
import { generateSubmissionId } from '@/lib/auth';

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

  // Check session
  const { data: session } = await supabase.from('exam_sessions').select('id, status, is_submitted').eq('id', payload.session_id).maybeSingle();

  if (!session || session.status !== 'active') {
    return NextResponse.json({ error: 'Session not active' }, { status: 403 });
  }

  // Check not already submitted
  const { data: existing } = await supabase.from('submissions').select('id').eq('session_id', payload.session_id).eq('question_id', question_id).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
  }

  // Verify assignment
  const { data: assigned } = await supabase.from('assigned_questions').select('session_id').eq('session_id', payload.session_id).eq('question_id', question_id).maybeSingle();
  if (!assigned) return NextResponse.json({ error: 'Not assigned' }, { status: 403 });

  // Algorithmic / structural check
  const logicCheck = checkCodeLogic(code, parseInt(question_id));
  if (!logicCheck.valid) {
    return NextResponse.json({
      success: false,
      compile_error: logicCheck.reason,
      passed_cases: 0,
      total_cases: 0,
      score: 0,
      max_score: 10,
    });
  }

  // Get ALL test cases (visible + hidden + edge)
  const { data: testCases } = await supabase.from('test_cases').select('*').eq('question_id', question_id);

  if (!testCases) {
    return NextResponse.json({ error: 'No test cases' }, { status: 404 });
  }

  // Run code against all test cases
  const results: Array<{
    test_case_id: number;
    passed: boolean;
    actual_output: string;
    execution_time: number;
    type: string;
  }> = [];

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
      passed,
      actual_output: result.timed_out ? 'TLE' : (result.output || ''),
      execution_time: result.execution_time || 0,
      type: tc.type,
    });
  }

  // Calculate score (10 marks per question)
  let score = 0;
  let compileScore = 0;
  let logicScore = 0;

  if (compiledOk) {
    compileScore = 2; // 2 marks for compiling + basic input handling

    const totalCases = results.length;
    const passedCases = results.filter(r => r.passed).length;
    const passRate = totalCases > 0 ? passedCases / totalCases : 0;

    // Logic score: 4 marks based on test case pass rate
    logicScore = Math.round(passRate * 4);

    // Output score: 2 marks
    const outputScore = passRate >= 1.0 ? 2 : passRate >= 0.5 ? 1 : 0;

    // Edge cases: 2 marks
    const edgeCases = results.filter(r => r.type === 'edge');
    const passedEdge = edgeCases.filter(r => r.passed).length;
    const edgeScore = edgeCases.length > 0
      ? Math.round((passedEdge / edgeCases.length) * 2)
      : (passRate >= 1.0 ? 2 : passRate >= 0.5 ? 1 : 0);

    score = compileScore + logicScore + outputScore + edgeScore;
    score = Math.min(10, score);
  }

  // Save submission
  const submissionId = generateSubmissionId();
  await supabase.from('submissions').insert({
    id: submissionId,
    session_id: payload.session_id,
    question_id,
    code,
    score,
    compile_score: compileScore,
    logic_score: logicScore
  });

  // Save test results
  if (compiledOk && results.length > 0) {
    const testResultsInsert = results.map(r => ({
      submission_id: submissionId,
      test_case_id: r.test_case_id,
      passed: r.passed ? 1 : 0,
      actual_output: r.actual_output,
      execution_time: r.execution_time
    }));
    await supabase.from('test_results').insert(testResultsInsert);
  }

  // Auto-save final code
  await supabase.from('code_saves').upsert({
    session_id: payload.session_id,
    question_id,
    code,
    updated_at: new Date().toISOString()
  });

  // Check if all 3 questions submitted → finalize session
  const { count: submittedCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('session_id', payload.session_id);
  const { count: assignedCount } = await supabase.from('assigned_questions').select('*', { count: 'exact', head: true }).eq('session_id', payload.session_id);

  if ((submittedCount || 0) >= (assignedCount || 3)) {
    await supabase.from('exam_sessions').update({ status: 'submitted', is_submitted: 1, end_time: new Date().toISOString() }).eq('id', payload.session_id);
  }

  const { data: showScores } = await supabase.from('settings').select('value').eq('key', 'show_scores_immediately').maybeSingle();

  return NextResponse.json({
    success: true,
    submission_id: submissionId,
    score: showScores?.value !== '0' ? score : null,
    max_score: 10,
    compile_error: compiledOk ? null : compileError,
    passed_cases: results.filter(r => r.passed).length,
    total_cases: results.length,
    all_submitted: (submittedCount || 0) >= (assignedCount || 3),
  });
}
