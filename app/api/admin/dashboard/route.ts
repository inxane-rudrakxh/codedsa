import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { count: total_students } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', 1);
  
  // Get all exam sessions to compute stats
  const { data: allSessions } = await supabase.from('exam_sessions').select('student_roll, is_submitted');
  const startedRolls = new Set(allSessions?.map(s => s.student_roll));
  const started = startedRolls.size;
  const submittedRolls = new Set(allSessions?.filter(s => s.is_submitted === 1).map(s => s.student_roll));
  const submitted = submittedRolls.size;

  const { data: durationSetting } = await supabase.from('settings').select('value').eq('key', 'exam_duration_minutes').maybeSingle();
  const durationMinutes = parseInt(durationSetting?.value || '60', 10);

  const { data: sessions } = await supabase.from('exam_sessions')
    .select(`
      id, student_roll, start_time, status, is_submitted, integrity_warnings,
      students (name, division)
    `)
    .order('start_time', { ascending: false })
    .limit(50);

  const activeSessions = [];
  if (sessions) {
    for (const session of sessions) {
      const elapsed = (Date.now() - new Date(session.start_time).getTime()) / 1000;
      const remaining = Math.max(0, durationMinutes * 60 - elapsed);
      const { count: submittedCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('session_id', session.id);

      const studentData = session.students as any;

      activeSessions.push({
        roll_no: session.student_roll,
        name: studentData?.name,
        division: studentData?.division,
        status: session.is_submitted ? 'submitted' : (remaining <= 0 ? 'expired' : 'active'),
        remaining_seconds: Math.floor(remaining),
        integrity_warnings: session.integrity_warnings,
        submitted_count: submittedCount || 0,
      });
    }
  }

  return NextResponse.json({
    total_students: total_students || 0,
    started,
    submitted,
    active_sessions: activeSessions,
  });
}
