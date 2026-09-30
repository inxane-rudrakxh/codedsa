import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  // Get active students
  const { data: students } = await supabase.from('students').select('*').eq('is_active', 1).order('roll_no');

  // Get sessions
  const { data: sessions } = await supabase.from('exam_sessions').select('*');

  // Get submissions
  const { data: submissions } = await supabase.from('submissions').select('*');

  // Get assigned questions
  const { data: assigned } = await supabase.from('assigned_questions').select('*');

  const results = students?.map(student => {
    const session = sessions?.find(s => s.student_roll === student.roll_no);
    let q1_score = null;
    let q2_score = null;
    let q3_score = null;

    if (session) {
      const sessionAssigned = assigned?.filter(a => a.session_id === session.id) || [];
      const sessionSubmissions = submissions?.filter(s => s.session_id === session.id) || [];

      const aq1 = sessionAssigned.find(a => a.order_index === 1);
      const aq2 = sessionAssigned.find(a => a.order_index === 2);
      const aq3 = sessionAssigned.find(a => a.order_index === 3);

      if (aq1) {
        const sub1 = sessionSubmissions.find(s => s.question_id === aq1.question_id);
        if (sub1) q1_score = sub1.score;
      }
      if (aq2) {
        const sub2 = sessionSubmissions.find(s => s.question_id === aq2.question_id);
        if (sub2) q2_score = sub2.score;
      }
      if (aq3) {
        const sub3 = sessionSubmissions.find(s => s.question_id === aq3.question_id);
        if (sub3) q3_score = sub3.score;
      }
    }

    const total_score = (q1_score || 0) + (q2_score || 0) + (q3_score || 0);

    return {
      roll_no: student.roll_no,
      name: student.name,
      division: student.division,
      branch: student.branch,
      session_id: session?.id || null,
      status: session?.status || null,
      start_time: session?.start_time || null,
      end_time: session?.end_time || null,
      is_submitted: session?.is_submitted || null,
      q1_score,
      q2_score,
      q3_score,
      total_score
    };
  });

  return NextResponse.json({ results: results || [] });
}
