import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { question_id, answer, answers } = body;

  const session = await prisma.examSession.findUnique({
    where: { id: payload.session_id },
    include: { test: true }
  });

  if (!session || session.status === 'EXPIRED' || session.status === 'STOPPED' || session.is_submitted) {
    return NextResponse.json({ error: 'Session is not active' }, { status: 403 });
  }

  // Handle single question save
  if (question_id && answer !== undefined) {
    await prisma.quizAnswer.upsert({
      where: {
        session_id_question_id: {
          session_id: payload.session_id,
          question_id: question_id,
        }
      },
      update: {
        selected_answer: String(answer),
        updated_at: new Date(),
      },
      create: {
        session_id: payload.session_id,
        question_id: question_id,
        selected_answer: String(answer),
        is_correct: false,
        marks_awarded: 0,
      }
    });
    return NextResponse.json({ success: true, saved_at: new Date() });
  }

  // Handle bulk answers save
  if (answers && typeof answers === 'object') {
    const entries = Object.entries(answers);
    for (const [qid, ans] of entries) {
      if (ans !== undefined && ans !== null) {
        await prisma.quizAnswer.upsert({
          where: {
            session_id_question_id: {
              session_id: payload.session_id,
              question_id: qid,
            }
          },
          update: {
            selected_answer: String(ans),
            updated_at: new Date(),
          },
          create: {
            session_id: payload.session_id,
            question_id: qid,
            selected_answer: String(ans),
            is_correct: false,
            marks_awarded: 0,
          }
        });
      }
    }
    return NextResponse.json({ success: true, saved_at: new Date() });
  }

  return NextResponse.json({ error: 'No question_id or answers provided' }, { status: 400 });
}
