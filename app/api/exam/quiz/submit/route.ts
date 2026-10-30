import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';
import { checkQuizAnswer } from '@/lib/quizGrader';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const session = await prisma.examSession.findUnique({
    where: { id: payload.session_id },
    include: { test: true }
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // If already submitted, return existing results
  if (session.is_submitted || session.status === 'COMPLETED') {
    const existingAnswers = await prisma.quizAnswer.findMany({
      where: { session_id: payload.session_id }
    });
    const totalScore = existingAnswers.reduce((sum, a) => sum + (a.marks_awarded || 0), 0);
    return NextResponse.json({
      success: true,
      already_submitted: true,
      total_score: session.test.marks_published ? totalScore : null,
      max_score: session.test.total_marks,
    });
  }

  // Parse optional incoming answers payload
  let incomingAnswers: Record<string, string> = {};
  try {
    const body = await request.json();
    if (body.answers && typeof body.answers === 'object') {
      incomingAnswers = body.answers;
    }
  } catch {}

  // Fetch all quiz questions for this test
  const quizQuestions = await prisma.quizQuestion.findMany({
    where: { test_id: session.test_id },
    orderBy: { order_index: 'asc' }
  });

  // Fetch previously saved answers for this session
  const existingAnswers = await prisma.quizAnswer.findMany({
    where: { session_id: payload.session_id }
  });
  const savedAnswerMap: Record<string, string> = {};
  existingAnswers.forEach(a => {
    if (a.selected_answer) savedAnswerMap[a.question_id] = a.selected_answer;
  });

  let totalScore = 0;

  for (const q of quizQuestions) {
    // Current answer: incoming or saved
    const studentAns = incomingAnswers[q.id] !== undefined ? incomingAnswers[q.id] : savedAnswerMap[q.id];

    const result = checkQuizAnswer(
      q.type,
      q.correct_answer,
      q.alternate_answers,
      q.options,
      studentAns,
      q.marks
    );

    if (result.is_correct) {
      totalScore += result.marks_awarded;
    }

    await prisma.quizAnswer.upsert({
      where: {
        session_id_question_id: {
          session_id: payload.session_id,
          question_id: q.id,
        }
      },
      update: {
        selected_answer: studentAns ? String(studentAns) : null,
        is_correct: result.is_correct,
        marks_awarded: result.marks_awarded,
        updated_at: new Date(),
      },
      create: {
        session_id: payload.session_id,
        question_id: q.id,
        selected_answer: studentAns ? String(studentAns) : null,
        is_correct: result.is_correct,
        marks_awarded: result.marks_awarded,
      }
    });
  }

  // Update session status to COMPLETED
  await prisma.examSession.update({
    where: { id: payload.session_id },
    data: {
      status: 'COMPLETED',
      is_submitted: true,
      end_time: new Date(),
    }
  });

  return NextResponse.json({
    success: true,
    total_score: session.test.marks_published ? totalScore : null,
    max_score: session.test.total_marks,
    marks_published: session.test.marks_published,
  });
}
