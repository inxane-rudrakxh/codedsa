import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyStudentToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { question_id, code } = body;

  if (!question_id || code === undefined) {
    return NextResponse.json({ error: 'question_id and code are required' }, { status: 400 });
  }

  // Verify this question belongs to the session
  const { data: assigned } = await supabase.from('assigned_questions')
    .select('session_id')
    .eq('session_id', payload.session_id)
    .eq('question_id', question_id)
    .maybeSingle();

  if (!assigned) return NextResponse.json({ error: 'Question not assigned to this session' }, { status: 403 });

  // Check session is active
  const { data: session } = await supabase.from('exam_sessions').select('status').eq('id', payload.session_id).maybeSingle();
  if (session?.status !== 'active') {
    return NextResponse.json({ error: 'Exam session is not active' }, { status: 403 });
  }

  // Check question not already submitted
  const { data: submitted } = await supabase.from('submissions')
    .select('id')
    .eq('session_id', payload.session_id)
    .eq('question_id', question_id)
    .maybeSingle();

  if (submitted) {
    return NextResponse.json({ error: 'Question already submitted' }, { status: 403 });
  }

  // Upsert code save
  await supabase.from('code_saves').upsert({
    session_id: payload.session_id,
    question_id,
    code,
    updated_at: new Date().toISOString()
  });

  return NextResponse.json({ success: true, saved_at: new Date().toISOString() });
}
