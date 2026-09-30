import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createStudentToken } from '@/lib/auth';
import { generateSessionId } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { roll_no, action } = body;

  if (!roll_no) {
    return NextResponse.json({ error: 'Roll number is required.' }, { status: 400 });
  }

  // Check exam is active
  const { data: examActive } = await supabase.from('settings').select('value').eq('key', 'exam_active').maybeSingle();
  if (examActive?.value === '0') {
    return NextResponse.json({ error: 'The exam is not currently active.' }, { status: 403 });
  }

  // Lookup student
  const { data: student } = await supabase.from('students').select('*').eq('roll_no', roll_no.trim()).eq('is_active', 1).maybeSingle();

  if (!student) {
    return NextResponse.json({ error: 'Roll number not found.' }, { status: 404 });
  }

  if (action === 'lookup') {
    return NextResponse.json({
      student: {
        roll_no: student.roll_no,
        name: student.name,
        division: student.division,
        branch: student.branch,
      },
    });
  }

  if (action === 'login') {
    // Check for existing active session
    const { data: existingSessions } = await supabase
      .from('exam_sessions')
      .select('id, start_time, status, is_submitted')
      .eq('student_roll', roll_no.trim())
      .neq('status', 'expired')
      .order('start_time', { ascending: false })
      .limit(1);
    
    const existingSession = existingSessions?.[0];

    let sessionId: string;

    if (existingSession) {
      sessionId = existingSession.id;

      // Check if session is still valid
      const { data: durationSetting } = await supabase.from('settings').select('value').eq('key', 'exam_duration_minutes').maybeSingle();
      const durationMinutes = parseInt(durationSetting?.value || '60', 10);
      const startTime = new Date(existingSession.start_time).getTime();
      const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes

      if (elapsed >= durationMinutes && !existingSession.is_submitted) {
        // Expire the session
        await supabase.from('exam_sessions').update({ status: 'expired', is_submitted: 1 }).eq('id', sessionId);
        existingSession.status = 'expired';
      }
    } else {
      // Create new session
      sessionId = generateSessionId();
      const startTime = new Date().toISOString();

      await supabase.from('exam_sessions').insert({
        id: sessionId,
        student_roll: roll_no.trim(),
        start_time: startTime,
        status: 'active',
        is_submitted: 0
      });

      // Assign 3 random questions
      const { data: enabledQuestions } = await supabase.from('questions').select('id').eq('is_enabled', 1);
      if (enabledQuestions) {
        const shuffled = enabledQuestions.sort(() => Math.random() - 0.5);
        const assigned = shuffled.slice(0, 3);

        if (assigned.length > 0) {
          await supabase.from('assigned_questions').insert(
            assigned.map((q, index) => ({ session_id: sessionId, question_id: q.id, order_index: index + 1 }))
          );

          // Initialize code saves
          const starterCode = `#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}`;
          await supabase.from('code_saves').insert(
            assigned.map(q => ({ session_id: sessionId, question_id: q.id, code: starterCode }))
          );
        }
      }
    }

    const token = await createStudentToken(roll_no.trim(), sessionId);

    return NextResponse.json({
      session_token: token,
      student: {
        roll_no: student.roll_no,
        name: student.name,
        division: student.division,
        branch: student.branch,
      },
    });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
