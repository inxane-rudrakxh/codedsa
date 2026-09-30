import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyStudentToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  // Get session
  const { data: sessionData } = await supabase.from('exam_sessions')
    .select('*')
    .eq('id', payload.session_id)
    .eq('student_roll', payload.roll_no)
    .maybeSingle();

  if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  let session = sessionData;

  // Check if session expired
  const { data: durationSetting } = await supabase.from('settings').select('value').eq('key', 'exam_duration_minutes').maybeSingle();
  const durationMinutes = parseInt(durationSetting?.value || '60', 10);
  const startTime = new Date(session.start_time).getTime();
  const elapsed = (Date.now() - startTime) / 1000; // seconds
  const remaining = Math.max(0, durationMinutes * 60 - elapsed);

  if (remaining <= 0 && session.status === 'active') {
    await supabase.from('exam_sessions').update({ status: 'expired', is_submitted: 1 }).eq('id', session.id);
    session.status = 'expired';
    session.is_submitted = 1;
  }

  // Get student
  const { data: student } = await supabase.from('students').select('*').eq('roll_no', payload.roll_no).maybeSingle();

  // Get assigned questions
  const { data: assignedRows } = await supabase.from('assigned_questions')
    .select(`order_index, questions:question_id (*)`)
    .eq('session_id', session.id)
    .order('order_index');

  const formattedQuestions = assignedRows?.map(r => ({
    ...(r.questions as any),
    order_index: r.order_index
  })) || [];

  // Get submissions
  const { data: submissionRows } = await supabase.from('submissions').select('*').eq('session_id', session.id);
  const submissions: Record<number, any> = {};
  submissionRows?.forEach(s => { submissions[s.question_id] = s; });

  // Get code saves
  const { data: saveRows } = await supabase.from('code_saves').select('*').eq('session_id', session.id);
  const saves: Record<number, string> = {};
  saveRows?.forEach(s => { saves[s.question_id] = s.code; });

  // Get visible test cases
  const testCases: Record<number, any[]> = {};
  if (formattedQuestions.length > 0) {
    const questionIds = formattedQuestions.map(q => q.id);
    const { data: casesData } = await supabase.from('test_cases')
      .select('question_id, input, expected_output, type')
      .eq('is_visible', 1)
      .in('question_id', questionIds);
    
    formattedQuestions.forEach(q => { testCases[q.id] = []; });
    casesData?.forEach(c => {
      if (testCases[c.question_id]) {
        testCases[c.question_id].push(c);
      }
    });
  }

  return NextResponse.json({
    session: {
      ...session,
      remaining_seconds: Math.floor(remaining),
    },
    student,
    questions: formattedQuestions,
    submissions,
    saves,
    testCases,
  });
}
