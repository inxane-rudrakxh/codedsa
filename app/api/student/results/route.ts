import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyAuthToken(token);
  if (!payload || payload.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { id: payload.user_id },
    include: { user: true, branch: true, division: true }
  });

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

  const sessions = await prisma.examSession.findMany({
    where: { student_id: student.id },
    include: {
      test: { include: { subject: true } },
      assignedQuestions: {
        include: { question: true },
        orderBy: { order_index: 'asc' }
      },
      submissions: {
        orderBy: { created_at: 'desc' }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  const sessionData = sessions.map(session => {
    const test = session.test;
    const questionsData = session.assignedQuestions.map(aq => {
      const subs = session.submissions.filter(s => s.question_id === aq.question_id);
      const sub = subs[0]; // latest
      return {
        question_id: aq.question_id,
        question_title: aq.question.title,
        order_index: aq.order_index,
        submitted: !!sub,
        status: sub?.status || null,
        passed_test_cases: sub?.passed_test_cases ?? null,
        total_test_cases: sub?.total_test_cases ?? null,
        // Only show marks if test has marks published
        marks_awarded: test.marks_published ? (sub?.marks_awarded ?? null) : null,
        max_marks: aq.question.marks,
      };
    });

    const total_score = test.marks_published
      ? questionsData.reduce((acc, q) => acc + (q.marks_awarded || 0), 0)
      : null;

    return {
      session_id: session.id,
      test_id: test.id,
      test_title: test.title,
      subject: test.subject.name,
      start_time: session.start_time,
      end_time: session.end_time,
      status: session.status,
      is_submitted: session.is_submitted,
      marks_published: test.marks_published,
      total_marks: test.total_marks,
      questions: questionsData,
      total_score,
    };
  });

  return NextResponse.json({
    student: {
      roll_number: student.roll_number,
      full_name: student.user.full_name,
      branch: student.branch.name,
      division: student.division?.name || '',
    },
    sessions: sessionData,
  });
}
