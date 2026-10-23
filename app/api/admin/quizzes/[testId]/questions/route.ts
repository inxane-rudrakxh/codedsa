import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/lib/permissions';
import { parseQuizText } from '@/lib/quizParser';

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

    if (!test) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    return NextResponse.json({ test, questions: test.quizQuestions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load questions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { testId } = await params;
  const body = await request.json();
  const { action } = body;

  try {
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    if (action === 'add_question') {
      const { type, question_text, options, correct_answer, alternate_answers, explanation, marks } = body;

      if (!question_text || !question_text.trim()) {
        return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
      }
      if (!correct_answer || !correct_answer.trim()) {
        return NextResponse.json({ error: 'Defined correct answer is required' }, { status: 400 });
      }

      const count = await prisma.quizQuestion.count({ where: { test_id: testId } });

      const created = await prisma.quizQuestion.create({
        data: {
          test_id: testId,
          type: type || 'MCQ',
          question_text: question_text.trim(),
          options: Array.isArray(options) ? options : [],
          correct_answer: correct_answer.trim(),
          alternate_answers: Array.isArray(alternate_answers) ? alternate_answers : [],
          explanation: explanation ? explanation.trim() : null,
          marks: parseFloat(marks) || 1,
          order_index: count + 1,
        },
      });

      // Update test total marks and questions_per_student
      const allQs = await prisma.quizQuestion.findMany({ where: { test_id: testId } });
      const newTotal = allQs.reduce((acc, q) => acc + (q.marks || 1), 0);
      await prisma.test.update({
        where: { id: testId },
        data: {
          total_marks: Math.round(newTotal),
          questions_per_student: allQs.length,
        },
      });

      return NextResponse.json({ success: true, question: created });
    }

    if (action === 'update_question') {
      const { id, type, question_text, options, correct_answer, alternate_answers, explanation, marks } = body;
      if (!id) return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });

      const updated = await prisma.quizQuestion.update({
        where: { id },
        data: {
          ...(type !== undefined ? { type } : {}),
          ...(question_text !== undefined ? { question_text: question_text.trim() } : {}),
          ...(options !== undefined ? { options: Array.isArray(options) ? options : [] } : {}),
          ...(correct_answer !== undefined ? { correct_answer: correct_answer.trim() } : {}),
          ...(alternate_answers !== undefined ? { alternate_answers: Array.isArray(alternate_answers) ? alternate_answers : [] } : {}),
          ...(explanation !== undefined ? { explanation: explanation ? explanation.trim() : null } : {}),
          ...(marks !== undefined ? { marks: parseFloat(marks) || 1 } : {}),
        },
      });

      const allQs = await prisma.quizQuestion.findMany({ where: { test_id: testId } });
      const newTotal = allQs.reduce((acc, q) => acc + (q.marks || 1), 0);
      await prisma.test.update({
        where: { id: testId },
        data: {
          total_marks: Math.round(newTotal),
          questions_per_student: allQs.length,
        },
      });

      return NextResponse.json({ success: true, question: updated });
    }

    if (action === 'delete_question') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });

      await prisma.quizAnswer.deleteMany({ where: { question_id: id } });
      await prisma.quizQuestion.delete({ where: { id } });

      const allQs = await prisma.quizQuestion.findMany({ where: { test_id: testId } });
      const newTotal = allQs.reduce((acc, q) => acc + (q.marks || 1), 0);
      await prisma.test.update({
        where: { id: testId },
        data: {
          total_marks: Math.round(newTotal),
          questions_per_student: allQs.length,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'bulk_import') {
      const { raw_text, parsed_questions, replace_existing } = body;

      let list = parsed_questions;
      if (raw_text && !list) {
        list = parseQuizText(raw_text);
      }

      if (!Array.isArray(list) || list.length === 0) {
        return NextResponse.json({ error: 'No questions could be parsed from text' }, { status: 400 });
      }

      if (replace_existing) {
        await prisma.quizAnswer.deleteMany({ where: { question: { test_id: testId } } });
        await prisma.quizQuestion.deleteMany({ where: { test_id: testId } });
      }

      const currentCount = replace_existing ? 0 : await prisma.quizQuestion.count({ where: { test_id: testId } });

      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        await prisma.quizQuestion.create({
          data: {
            test_id: testId,
            type: q.type || 'MCQ',
            question_text: q.question_text,
            options: Array.isArray(q.options) ? q.options : [],
            correct_answer: q.correct_answer || '',
            alternate_answers: Array.isArray(q.alternate_answers) ? q.alternate_answers : [],
            explanation: q.explanation || null,
            marks: parseFloat(q.marks) || 1,
            order_index: currentCount + i + 1,
          },
        });
      }

      const allQs = await prisma.quizQuestion.findMany({ where: { test_id: testId } });
      const newTotal = allQs.reduce((acc, q) => acc + (q.marks || 1), 0);
      await prisma.test.update({
        where: { id: testId },
        data: {
          total_marks: Math.round(newTotal),
          questions_per_student: allQs.length,
        },
      });

      return NextResponse.json({ success: true, count: list.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 });
  }
}
