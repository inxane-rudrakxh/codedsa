import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });

  try {
    const session = await prisma.examSession.findUnique({
      where: { id: payload.session_id },
      include: {
        test: {
          include: {
            subject: true,
          },
        },
        student: {
          include: {
            user: true,
            branch: true,
            division: true,
          },
        },
        quizAnswers: true,
      },
    });

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    // Check expiration
    const durationMinutes = session.test.duration_minutes || 30;
    const startTime = new Date(session.start_time).getTime();
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const totalSeconds = durationMinutes * 60;
    const remainingSeconds = Math.max(0, Math.round(totalSeconds - elapsedSeconds));

    if (remainingSeconds <= 0 && !session.is_submitted && session.status !== 'EXPIRED' && session.status !== 'STOPPED') {
      await prisma.examSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED', is_submitted: true, end_time: new Date() },
      });
      session.status = 'EXPIRED';
      session.is_submitted = true;
    }

    // Load Quiz Questions (ordered)
    let questions = await prisma.quizQuestion.findMany({
      where: { test_id: session.test_id },
      orderBy: { order_index: 'asc' },
    });

    // Strip sensitive fields (correct_answer, alternate_answers)
    const sanitizedQuestions = questions.map((q, idx) => ({
      id: q.id,
      order_index: idx + 1,
      type: q.type, // "MCQ" | "FILL_BLANK" | "ODD_ONE_OUT"
      question_text: q.question_text,
      options: q.options || [],
      marks: q.marks,
    }));

    // Map saved answers
    const savedAnswers: Record<string, string> = {};
    (session.quizAnswers || []).forEach(ans => {
      if (ans.selected_answer !== null && ans.selected_answer !== undefined) {
        savedAnswers[ans.question_id] = ans.selected_answer;
      }
    });

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        is_submitted: session.is_submitted,
        start_time: session.start_time,
        end_time: session.end_time,
        remaining_seconds: remainingSeconds,
        duration_minutes: durationMinutes,
        integrity_warnings: session.integrity_warnings,
        test_title: session.test.title,
        test_instructions: session.test.instructions,
        marks_published: session.test.marks_published,
      },
      student: {
        roll_no: session.student.roll_number,
        name: session.student.user.full_name,
        division: session.student.division?.name || 'A',
        branch: session.student.branch?.name || 'AI&DS',
      },
      questions: sanitizedQuestions,
      saved_answers: savedAnswers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
