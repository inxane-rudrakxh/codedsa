import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (payload && payload.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const students = await prisma.student.findMany({
    where: { user: { status: 'ACTIVE' } },
    include: { user: true, branch: true, division: true },
    orderBy: { roll_number: 'asc' }
  });

  const sessions = await prisma.examSession.findMany({
    include: {
      assignedQuestions: true,
      submissions: true
    }
  });

  const results = students.map(student => {
    const session = sessions.find(s => s.student_id === student.id);
    let q1_score = null;
    let q2_score = null;
    let q3_score = null;
    let q1_code = null;
    let q2_code = null;
    let q3_code = null;

    let q1_sub_id = null;
    let q2_sub_id = null;
    let q3_sub_id = null;

    if (session) {
      const aq1 = session.assignedQuestions.find(a => a.order_index === 1);
      const aq2 = session.assignedQuestions.find(a => a.order_index === 2);
      const aq3 = session.assignedQuestions.find(a => a.order_index === 3);

      if (aq1) {
        const sub1 = session.submissions.find(s => s.question_id === aq1.question_id);
        if (sub1) { q1_score = sub1.marks_awarded; q1_code = sub1.source_code; q1_sub_id = sub1.id; }
      }
      if (aq2) {
        const sub2 = session.submissions.find(s => s.question_id === aq2.question_id);
        if (sub2) { q2_score = sub2.marks_awarded; q2_code = sub2.source_code; q2_sub_id = sub2.id; }
      }
      if (aq3) {
        const sub3 = session.submissions.find(s => s.question_id === aq3.question_id);
        if (sub3) { q3_score = sub3.marks_awarded; q3_code = sub3.source_code; q3_sub_id = sub3.id; }
      }
    }

    const total_score = (q1_score || 0) + (q2_score || 0) + (q3_score || 0);

    return {
      roll_no: student.roll_number,
      name: student.user.full_name,
      division: student.division?.name || 'A',
      branch: student.branch?.name || 'AI&DS',
      session_id: session?.id || null,
      status: session?.status || null,
      start_time: session?.start_time || null,
      end_time: session?.end_time || null,
      is_submitted: session?.is_submitted ? 1 : 0,
      q1_score,
      q2_score,
      q3_score,
      q1_code,
      q2_code,
      q3_code,
      q1_sub_id,
      q2_sub_id,
      q3_sub_id,
      total_score
    };
  });

  return NextResponse.json({ results });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (payload && payload.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { submission_id, marks_awarded } = body;

  if (!submission_id || marks_awarded === undefined) {
    return NextResponse.json({ error: 'Missing submission_id or marks_awarded' }, { status: 400 });
  }

  await prisma.submission.update({
    where: { id: submission_id },
    data: { marks_awarded: parseInt(marks_awarded) }
  });

  return NextResponse.json({ success: true });
}
