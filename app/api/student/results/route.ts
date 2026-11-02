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
      test: {
        include: {
          subject: true,
          quizQuestions: { orderBy: { order_index: 'asc' } },
        }
      },
      assignedQuestions: {
        include: { question: true },
        orderBy: { order_index: 'asc' }
      },
      submissions: {
        orderBy: { created_at: 'desc' }
      },
      quizAnswers: true,
    },
    orderBy: { created_at: 'desc' }
  });

  const sessionData = sessions.map(session => {
    const test = session.test;
    const isQuiz = test.test_type === 'QUIZ' || test.test_type === 'PUZZLE';

    let questionsData: Array<{
      question_id: string;
      question_title: string;
      order_index: number;
      submitted: boolean;
      status: string | null;
      passed_test_cases: number | null;
      total_test_cases: number | null;
      marks_awarded: number | null;
      max_marks: number;
    }> = [];

    let total_score: number | null = null;

    if (isQuiz) {
      const qqs = test.quizQuestions || [];
      questionsData = qqs.map(qq => {
        const ans = session.quizAnswers.find(a => a.question_id === qq.id);
        return {
          question_id: qq.id,
          question_title: qq.question_text,
          order_index: qq.order_index,
          submitted: !!ans?.selected_answer,
          status: ans ? (ans.is_correct ? 'CORRECT' : 'INCORRECT') : null,
          passed_test_cases: ans?.is_correct ? 1 : 0,
          total_test_cases: 1,
          marks_awarded: test.marks_published ? (ans?.marks_awarded ?? null) : null,
          max_marks: qq.marks,
        };
      });

      total_score = test.marks_published
        ? session.quizAnswers.reduce((acc, a) => acc + (a.marks_awarded || 0), 0)
        : null;
    } else {
      questionsData = session.assignedQuestions.map(aq => {
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

      total_score = test.marks_published
        ? questionsData.reduce((acc, q) => acc + (q.marks_awarded || 0), 0)
        : null;
    }

    return {
      session_id: session.id,
      test_id: test.id,
      test_title: test.title,
      subject: test.subject?.name || '',
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
      branch: student.branch?.name || 'AI&DS',
      division: student.division?.name || '',
    },
    sessions: sessionData,
  });
}
