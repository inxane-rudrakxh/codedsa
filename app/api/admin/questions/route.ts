import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser, teacherScope } from '@/lib/permissions';
import { parseQuizText } from '@/lib/quizParser';

export async function GET(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = teacherScope(payload);
  const url = new URL(request.url);
  const test_id = url.searchParams.get('test_id');
  const bank_id = url.searchParams.get('bank_id');

  const questions = await prisma.question.findMany({
    where: scope ? { teacher_id: scope } : {},
    include: {
      testCases: { orderBy: { order_index: 'asc' } },
      subject: true,
    },
    orderBy: { created_at: 'desc' }
  });

  const questionBanks = await prisma.questionBank.findMany({
    include: {
      _count: { select: { quizQuestions: true } }
    },
    orderBy: { created_at: 'desc' }
  });

  const quizQuestions = await prisma.quizQuestion.findMany({
    where: bank_id ? { bank_id } : {},
    orderBy: { order_index: 'asc' }
  });

  const subjects = await prisma.subject.findMany();

  // If test_id is provided, also return the questions assigned to that test
  if (test_id) {
    const testQuestions = await prisma.testQuestion.findMany({
      where: { test_id },
      orderBy: { order_index: 'asc' },
    });
    return NextResponse.json({
      questions,
      questionBanks,
      quizQuestions,
      subjects,
      assignedQuestions: testQuestions
    });
  }

  return NextResponse.json({
    questions,
    questionBanks,
    quizQuestions,
    subjects
  });
}

export async function POST(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  // =========================================================================
  // QUESTION BANK ACTIONS
  // =========================================================================
  if (action === 'create_bank') {
    const { name, description, category, subject_code, total_marks, duration_minutes } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Bank name is required' }, { status: 400 });
    }

    const existing = await prisma.questionBank.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'A question bank with this name already exists' }, { status: 409 });
    }

    const bank = await prisma.questionBank.create({
      data: {
        name: name.trim(),
        description: description || null,
        category: category || null,
        subject_code: subject_code || 'DSA',
        total_marks: parseInt(total_marks) || 30,
        duration_minutes: parseInt(duration_minutes) || 30,
      }
    });

    return NextResponse.json({ success: true, bank });
  }

  if (action === 'delete_bank') {
    const { bank_id } = body;
    if (!bank_id) return NextResponse.json({ error: 'bank_id is required' }, { status: 400 });
    await prisma.quizQuestion.deleteMany({ where: { bank_id } });
    await prisma.questionBank.delete({ where: { id: bank_id } });
    return NextResponse.json({ success: true });
  }

  if (action === 'create_quiz_question') {
    const { bank_id, bank_name, question_text, code_snippet, type, options, correct_answer, alternate_answers, explanation, marks } = body;
    if (!question_text || !question_text.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    const count = await prisma.quizQuestion.count({ where: { bank_id: bank_id || undefined } });
    const question = await prisma.quizQuestion.create({
      data: {
        bank_id: bank_id || null,
        bank_name: bank_name || null,
        type: type || 'SHORT_ANSWER',
        question_text: question_text.trim(),
        code_snippet: code_snippet ? code_snippet.trim() : null,
        options: Array.isArray(options) ? options.filter(Boolean) : [],
        correct_answer: (correct_answer || '').trim(),
        alternate_answers: Array.isArray(alternate_answers) ? alternate_answers.filter(Boolean) : [],
        explanation: explanation ? explanation.trim() : null,
        marks: parseFloat(marks) || 1,
        order_index: count + 1,
      }
    });

    return NextResponse.json({ success: true, question });
  }

  if (action === 'update_quiz_question') {
    const { id, question_text, code_snippet, type, options, correct_answer, alternate_answers, explanation, marks } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await prisma.quizQuestion.update({
      where: { id },
      data: {
        question_text: question_text ? question_text.trim() : undefined,
        code_snippet: code_snippet !== undefined ? (code_snippet ? code_snippet.trim() : null) : undefined,
        type: type || undefined,
        options: Array.isArray(options) ? options : undefined,
        correct_answer: correct_answer !== undefined ? correct_answer.trim() : undefined,
        alternate_answers: Array.isArray(alternate_answers) ? alternate_answers : undefined,
        explanation: explanation !== undefined ? (explanation ? explanation.trim() : null) : undefined,
        marks: marks !== undefined ? parseFloat(marks) : undefined,
      }
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'delete_quiz_question') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await prisma.quizQuestion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  if (action === 'bulk_import_bank') {
    const { bank_id, text, questions } = body;
    if (!bank_id) return NextResponse.json({ error: 'bank_id is required' }, { status: 400 });

    const bank = await prisma.questionBank.findUnique({ where: { id: bank_id } });
    if (!bank) return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });

    let toInsert: Array<{
      question_text: string;
      code_snippet?: string;
      type: string;
      options: string[];
      correct_answer: string;
      alternate_answers: string[];
      explanation?: string;
      marks: number;
    }> = [];

    // If array passed directly
    if (Array.isArray(questions) && questions.length > 0) {
      toInsert = questions;
    } else if (text && typeof text === 'string') {
      // 1. Try MCQ parser first
      const mcqParsed = parseQuizText(text);
      if (mcqParsed.length > 0) {
        toInsert = mcqParsed.map(p => ({
          question_text: p.question_text,
          type: p.type || 'MCQ',
          options: p.options || [],
          correct_answer: p.correct_answer || '',
          alternate_answers: p.alternate_answers || [],
          explanation: p.explanation,
          marks: p.marks || 1,
        }));
      } else {
        // 2. Parse general numbered questions blocks:
        // Q1. ... Answer: ... Marks: ...
        const blocks = text.split(/\n(?=(?:Q\d+[\.:\s]|\d+[\.:\)]\s+|Question\s+\d+[\.:\s]))/i);
        for (const block of blocks) {
          const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length === 0) continue;

          let qText = '';
          let cAnswer = '';
          let marksVal = 1;
          let exp = '';

          for (const line of lines) {
            const ansMatch = line.match(/^(?:Answer|Ans|Key)\s*[:=-]\s*(.*)$/i);
            const markMatch = line.match(/^(?:Marks?|Pts?|Points?)\s*[:=-]\s*(\d+(?:\.\d+)?)/i);
            const expMatch = line.match(/^(?:Explanation|Reason|Note)\s*[:=-]\s*(.*)$/i);

            if (ansMatch) {
              cAnswer = ansMatch[1].trim();
            } else if (markMatch) {
              marksVal = parseFloat(markMatch[1]) || 1;
            } else if (expMatch) {
              exp = expMatch[1].trim();
            } else {
              qText = qText ? `${qText}\n${line}` : line;
            }
          }

          if (qText) {
            toInsert.push({
              question_text: qText.replace(/^(?:Q\d+[\.:\s]+|\d+[\.:\)]\s+|Question\s+\d+[\.:\s]+)/i, ''),
              type: 'SHORT_ANSWER',
              options: [],
              correct_answer: cAnswer,
              alternate_answers: [],
              explanation: exp || undefined,
              marks: marksVal,
            });
          }
        }
      }
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ error: 'No valid questions could be parsed from the provided text.' }, { status: 400 });
    }

    let startOrder = await prisma.quizQuestion.count({ where: { bank_id } });
    for (const q of toInsert) {
      startOrder++;
      await prisma.quizQuestion.create({
        data: {
          bank_id: bank.id,
          bank_name: bank.name,
          question_text: q.question_text,
          code_snippet: q.code_snippet || null,
          type: q.type || 'SHORT_ANSWER',
          options: q.options || [],
          correct_answer: q.correct_answer || '',
          alternate_answers: q.alternate_answers || [],
          explanation: q.explanation || null,
          marks: q.marks || 1,
          order_index: startOrder,
        }
      });
    }

    return NextResponse.json({ success: true, count: toInsert.length });
  }

  if (action === 'create_test_from_bank') {
    const { bank_id, title, duration_minutes, target_division, auto_approve } = body;
    if (!bank_id) return NextResponse.json({ error: 'bank_id is required' }, { status: 400 });

    const bank = await prisma.questionBank.findUnique({
      where: { id: bank_id },
      include: { quizQuestions: { orderBy: { order_index: 'asc' } } }
    });
    if (!bank) return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });

    const subject = await prisma.subject.findFirst({
      where: { code: bank.subject_code || 'DSA' }
    }) || await prisma.subject.findFirst();

    if (!subject) return NextResponse.json({ error: 'No subject found' }, { status: 400 });

    const crypto = require('crypto');
    const slugBase = bank.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').substring(0, 16).replace(/-+$/, '');
    const randomHex = crypto.randomBytes(3).toString('hex');
    const uniqueId = `${slugBase}-${randomHex}`;

    const totalMarks = bank.quizQuestions.reduce((sum, q) => sum + q.marks, 0) || bank.total_marks || 30;

    const test = await prisma.test.create({
      data: {
        unique_id: uniqueId,
        title: title || bank.name,
        description: bank.description || `Assessment generated from ${bank.name}`,
        instructions: `All ${bank.quizQuestions.length} questions are compulsory. Carefully examine each question before answering. Fullscreen and anti-cheat monitoring are strictly enforced. Switching tabs or exiting fullscreen more than 3 times will automatically submit your exam.`,
        subject_id: subject.id,
        teacher_id: payload.user_id,
        duration_minutes: parseInt(duration_minutes) || bank.duration_minutes || 30,
        total_marks: Math.round(totalMarks),
        questions_per_student: bank.quizQuestions.length,
        target_division: target_division || null,
        test_type: 'QUIZ',
        auto_approve: auto_approve === true,
        marks_published: true,
        randomize_questions: false,
        status: 'PUBLISHED',
      }
    });

    // Copy questions to test
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

    return NextResponse.json({ success: true, test });
  }

  // =========================================================================
  // CODING QUESTION ACTIONS (Existing)
  // =========================================================================
  if (action === 'create') {
    const { title, topic, description, input_format, output_format, constraints, sample_input, sample_output, explanation, marks, difficulty, subject_name } = body;
    
    let subject_id = body.subject_id;
    if (subject_name) {
      let subj = await prisma.subject.findFirst({ where: { name: subject_name } });
      if (!subj) {
        subj = await prisma.subject.create({ 
          data: { name: subject_name, code: subject_name.toUpperCase().replace(/[^A-Z0-9]/g, '_') } 
        });
      }
      subject_id = subj.id;
    }

    if (!title || !description || !subject_id) {
      return NextResponse.json({ error: 'title, description, and subject are required' }, { status: 400 });
    }

    const teacher_id = payload.user_id;
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}-${Date.now()}`;

    const question = await prisma.question.create({
      data: {
        title,
        slug,
        description,
        subject_id,
        teacher_id,
        topic: topic || null,
        difficulty: difficulty || 'MEDIUM',
        marks: parseInt(marks) || 10,
        input_format: input_format || null,
        output_format: output_format || null,
        constraints: constraints || null,
        sample_input: sample_input || null,
        sample_output: sample_output || null,
        explanation: explanation || null,
      }
    });
    return NextResponse.json({ success: true, question });
  }

  if (action === 'update') {
    const { id, title, topic, description, input_format, output_format, constraints, sample_input, sample_output, explanation, marks, difficulty } = body;
    
    const q = await prisma.question.findUnique({ where: { id } });
    if (!q || (payload.role !== 'ADMIN' && q.teacher_id !== payload.user_id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.question.update({
      where: { id },
      data: {
        title,
        topic: topic || null,
        description,
        input_format: input_format || null,
        output_format: output_format || null,
        constraints: constraints || null,
        sample_input: sample_input || null,
        sample_output: sample_output || null,
        explanation: explanation || null,
        marks: parseInt(marks) || 10,
        difficulty: difficulty || 'MEDIUM',
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete') {
    const { id } = body;
    const q = await prisma.question.findUnique({ where: { id } });
    if (!q || (payload.role !== 'ADMIN' && q.teacher_id !== payload.user_id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    await prisma.testCase.deleteMany({ where: { question_id: id } });
    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  if (action === 'add_test_case') {
    const { question_id, input, expected_output, is_hidden, marks } = body;
    const q = await prisma.question.findUnique({ where: { id: question_id } });
    if (!q || (payload.role !== 'ADMIN' && q.teacher_id !== payload.user_id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    const count = await prisma.testCase.count({ where: { question_id } });
    await prisma.testCase.create({
      data: {
        question_id,
        input: input ?? '',
        expected_output: expected_output ?? '',
        is_hidden: is_hidden || false,
        marks: parseInt(marks) || 1,
        order_index: count,
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_test_case') {
    const tc = await prisma.testCase.findUnique({
      where: { id: body.id },
      include: { question: true }
    });
    if (!tc || (payload.role !== 'ADMIN' && tc.question.teacher_id !== payload.user_id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    await prisma.testCase.delete({ where: { id: body.id } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
