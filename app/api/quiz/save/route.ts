import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { question_id, selected_answer } = body;

  if (!question_id) {
    return NextResponse.json({ error: 'Question ID required' }, { status: 400 });
  }

  try {
    const session = await prisma.examSession.findUnique({
      where: { id: payload.session_id },
    });

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.is_submitted || session.status === 'EXPIRED' || session.status === 'STOPPED') {
      return NextResponse.json({ error: 'Assessment already submitted' }, { status: 403 });
    }

    const existing = await prisma.quizAnswer.findUnique({
      where: {
        session_id_question_id: {
          session_id: session.id,
          question_id: question_id,
        },
      },
    });

    if (existing) {
      await prisma.quizAnswer.update({
        where: { id: existing.id },
        data: {
          selected_answer: selected_answer !== undefined ? String(selected_answer) : null,
        },
      });
    } else {
      await prisma.quizAnswer.create({
        data: {
          session_id: session.id,
          question_id: question_id,
          selected_answer: selected_answer !== undefined ? String(selected_answer) : null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save answer' }, { status: 500 });
  }
}
