import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    let test = await prisma.test.findUnique({
      where: { unique_id: slug },
      include: {
        subject: true,
        testQuestions: true,
        quizQuestions: {
          select: { id: true, type: true }
        }
      }
    });

    // Fallback: If not found by exact unique_id, resolve common aliases like 'puzzle'
    if (!test && slug.trim().toLowerCase() === 'puzzle') {
      test = await prisma.test.findFirst({
        where: {
          OR: [
            { unique_id: { equals: 'puzzle', mode: 'insensitive' } },
            { test_type: 'PUZZLE', status: 'PUBLISHED' },
            { title: { contains: 'Puzzle', mode: 'insensitive' }, status: 'PUBLISHED' }
          ]
        },
        orderBy: { created_at: 'desc' },
        include: {
          subject: true,
          testQuestions: true,
          quizQuestions: {
            select: { id: true, type: true }
          }
        }
      });
    }

    if (!test) {
      return NextResponse.json({ error: 'Assessment Not Found' }, { status: 404 });
    }

    if (test.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Assessment Closed' }, { status: 403 });
    }

    if (test.status === 'DRAFT') {
      return NextResponse.json({ error: 'Assessment Not Started' }, { status: 403 });
    }
    
    // Check time based scheduling if needed
    const now = new Date();
    if (test.start_time && new Date(test.start_time) > now) {
      return NextResponse.json({ error: `Assessment Not Started\nThis assessment will become available at: ${new Date(test.start_time).toLocaleString()}` }, { status: 403 });
    }
    if (test.end_time && new Date(test.end_time) < now) {
      return NextResponse.json({ error: 'Assessment Closed' }, { status: 403 });
    }

    const isQuiz = test.test_type === 'QUIZ' || test.test_type === 'PUZZLE';

    // Auto-recovery: If quiz/puzzle test has 0 questions, copy from matching question bank
    if (isQuiz && (!test.quizQuestions || test.quizQuestions.length === 0)) {
      const isPuzzle = test.test_type === 'PUZZLE' || test.title.toLowerCase().includes('puzzle') || test.title.toLowerCase().includes('linked list');
      const bank = await prisma.questionBank.findFirst({
        where: isPuzzle 
          ? { OR: [{ category: 'PUZZLE' }, { name: { contains: 'Linked Lists', mode: 'insensitive' } }] }
          : { OR: [{ category: 'QUIZ' }, { name: { contains: 'Stacks', mode: 'insensitive' } }] },
        include: { quizQuestions: { where: { test_id: null }, orderBy: { order_index: 'asc' } } }
      });

      if (bank && bank.quizQuestions.length > 0) {
        for (let i = 0; i < bank.quizQuestions.length; i++) {
          const bq = bank.quizQuestions[i];
          await prisma.quizQuestion.create({
            data: {
              test_id: test.id,
              bank_id: bank.id,
              bank_name: bank.name,
              type: bq.type,
              question_text: bq.question_text,
              code_snippet: bq.code_snippet,
              options: bq.options,
              correct_answer: bq.correct_answer,
              alternate_answers: bq.alternate_answers,
              explanation: bq.explanation,
              marks: bq.marks,
              order_index: i + 1,
            }
          });
        }
        const updatedQuizQuestions = await prisma.quizQuestion.findMany({
          where: { test_id: test.id },
          select: { id: true, type: true }
        });
        test.quizQuestions = updatedQuizQuestions as any;
      }
    }

    const questionCount = isQuiz
      ? (test.quizQuestions?.length || test.questions_per_student)
      : test.questions_per_student;

    return NextResponse.json({
      test: {
        id: test.id,
        unique_id: test.unique_id,
        title: test.title,
        duration_minutes: test.duration_minutes,
        total_marks: test.total_marks,
        subject: test.subject.name,
        question_count: questionCount,
        test_type: test.test_type || 'CODING',
        auto_approve: test.auto_approve ?? false,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
