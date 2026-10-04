import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const payload = await verifyAuthToken(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const tests = await prisma.test.findMany({
    include: {
      subject: true,
      testQuestions: {
        include: { question: true },
        orderBy: { order_index: 'asc' }
      }
    },
    orderBy: { id: 'desc' }
  });
  
  const allQuestions = await prisma.question.findMany({
    select: { id: true, title: true, topic: true },
    orderBy: { id: 'asc' }
  });

  const subjects = await prisma.subject.findMany();

  return NextResponse.json({ tests, allQuestions, subjects });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const payload = await verifyAuthToken(token);
  if (!payload || payload.role !== 'ADMIN') return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'create_test') {
    const { title, subject_id, duration_minutes, total_marks, questions_per_student } = body;
    const test = await prisma.test.create({
      data: {
        title,
        subject_id: subject_id,
        duration_minutes: parseInt(duration_minutes),
        total_marks: parseInt(total_marks),
        questions_per_student: parseInt(questions_per_student),
        status: 'DRAFT'
      }
    });
    return NextResponse.json({ success: true, test });
  }

  if (action === 'update_test') {
    const { id, title, duration_minutes, total_marks, questions_per_student, status } = body;
    await prisma.test.update({
      where: { id: id },
      data: {
        title,
        duration_minutes: parseInt(duration_minutes),
        total_marks: parseInt(total_marks),
        questions_per_student: parseInt(questions_per_student),
        status
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'assign_question') {
    const { test_id, question_id } = body;
    const count = await prisma.testQuestion.count({ where: { test_id: test_id } });
    await prisma.testQuestion.create({
      data: {
        test_id: test_id,
        question_id: question_id,
        order_index: count
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'remove_question') {
    const { test_id, question_id } = body;
    await prisma.testQuestion.delete({
      where: {
        test_id_question_id: { test_id: test_id, question_id: question_id }
      }
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
