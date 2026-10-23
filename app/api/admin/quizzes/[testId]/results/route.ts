import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/lib/permissions';

export async function GET(request: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { testId } = await params;

  try {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        quizQuestions: {
          orderBy: { order_index: 'asc' },
        },
      },
    });

    if (!test) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    const sessions = await prisma.examSession.findMany({
      where: { test_id: testId },
      include: {
        student: {
          include: {
            user: true,
            branch: true,
            division: true,
          },
        },
        quizAnswers: {
          include: {
            question: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const results = sessions.map(session => {
      const answers = session.quizAnswers || [];
      const totalScore = answers.reduce((acc, a) => acc + (a.marks_awarded || 0), 0);
      const correctCount = answers.filter(a => a.is_correct).length;
      
      const startTime = session.start_time ? new Date(session.start_time).getTime() : 0;
      const endTime = session.end_time ? new Date(session.end_time).getTime() : Date.now();
      const durationSeconds = startTime ? Math.max(0, Math.round((endTime - startTime) / 1000)) : 0;

      return {
        session_id: session.id,
        status: session.status,
        is_submitted: session.is_submitted,
        score: totalScore,
        total_marks: test.total_marks,
        percentage: test.total_marks > 0 ? Math.round((totalScore / test.total_marks) * 100) : 0,
        correct_count: correctCount,
        total_questions: test.quizQuestions.length,
        duration_seconds: durationSeconds,
        start_time: session.start_time,
        end_time: session.end_time,
        student: {
          id: session.student.id,
          roll_no: session.student.roll_number,
          name: session.student.user.full_name,
          division: session.student.division?.name || 'A',
          branch: session.student.branch?.name || 'AI&DS',
        },
        answers: answers.map(a => ({
          question_id: a.question_id,
          question_text: a.question.question_text,
          type: a.question.type,
          selected_answer: a.selected_answer,
          correct_answer: a.question.correct_answer,
          is_correct: a.is_correct,
          marks_awarded: a.marks_awarded,
          max_marks: a.question.marks,
        })),
      };
    });

    return NextResponse.json({ test, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch results' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { testId } = await params;
  const body = await request.json();
  const { action, session_id } = body;

  try {
    if (action === 'delete_session') {
      if (!session_id) return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
      await prisma.quizAnswer.deleteMany({ where: { session_id } });
      await prisma.examSession.delete({ where: { id: session_id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_publish') {
      const { marks_published } = body;
      await prisma.test.update({
        where: { id: testId },
        data: { marks_published: Boolean(marks_published) },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Action failed' }, { status: 500 });
  }
}
