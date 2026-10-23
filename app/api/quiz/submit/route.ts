import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';
import { checkQuizAnswer } from '@/lib/quizGrader';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const incomingAnswers: Record<string, string> = body.answers || {};

  try {
    const session = await prisma.examSession.findUnique({
      where: { id: payload.session_id },
      include: {
        test: true,
        quizAnswers: true,
      },
    });

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Load all quiz questions for this test
    const questions = await prisma.quizQuestion.findMany({
      where: { test_id: session.test_id },
      orderBy: { order_index: 'asc' },
    });

    // Merge answers from DB and incoming body
    const answerMap: Record<string, string> = {};
    session.quizAnswers.forEach(a => {
      if (a.selected_answer) answerMap[a.question_id] = a.selected_answer;
    });
    Object.entries(incomingAnswers).forEach(([qid, val]) => {
      if (val !== undefined && val !== null) answerMap[qid] = String(val);
    });

    let totalScore = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    for (const q of questions) {
      const qMarks = q.marks || 1;
      totalMarks += qMarks;

      const studentAns = answerMap[q.id];
      if (!studentAns || studentAns.trim() === '') {
        unansweredCount++;
        // Upsert empty answer record
        const existing = await prisma.quizAnswer.findUnique({
          where: { session_id_question_id: { session_id: session.id, question_id: q.id } },
        });
        if (existing) {
          await prisma.quizAnswer.update({
            where: { id: existing.id },
            data: { is_correct: false, marks_awarded: 0 },
          });
        } else {
          await prisma.quizAnswer.create({
            data: {
              session_id: session.id,
              question_id: q.id,
              selected_answer: null,
              is_correct: false,
              marks_awarded: 0,
            },
          });
        }
        continue;
      }

      const grade = checkQuizAnswer(
        q.type,
        q.correct_answer,
        q.alternate_answers,
        q.options,
        studentAns,
        qMarks
      );

      if (grade.is_correct) {
        correctCount++;
        totalScore += grade.marks_awarded;
      } else {
        wrongCount++;
      }

      const existing = await prisma.quizAnswer.findUnique({
        where: { session_id_question_id: { session_id: session.id, question_id: q.id } },
      });

      if (existing) {
        await prisma.quizAnswer.update({
          where: { id: existing.id },
          data: {
            selected_answer: studentAns,
            is_correct: grade.is_correct,
            marks_awarded: grade.marks_awarded,
          },
        });
      } else {
        await prisma.quizAnswer.create({
          data: {
            session_id: session.id,
            question_id: q.id,
            selected_answer: studentAns,
            is_correct: grade.is_correct,
            marks_awarded: grade.marks_awarded,
          },
        });
      }
    }

    // Finalize session
    await prisma.examSession.update({
      where: { id: session.id },
      data: {
        status: 'SUBMITTED',
        is_submitted: true,
        end_time: new Date(),
      },
    });

    const percentage = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;

    return NextResponse.json({
      success: true,
      total_score: totalScore,
      total_marks: totalMarks,
      percentage,
      correct_count: correctCount,
      wrong_count: wrongCount,
      unanswered_count: unansweredCount,
      total_questions: questions.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Submission failed' }, { status: 500 });
  }
}
