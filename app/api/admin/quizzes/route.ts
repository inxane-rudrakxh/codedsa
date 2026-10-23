import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser, teacherScope } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = teacherScope(payload);

  try {
    const quizzes = await prisma.test.findMany({
      where: {
        test_type: 'QUIZ',
        ...(scope ? {
          OR: [
            { teacher_id: scope },
            { teacher_id: null },
          ]
        } : {}),
      },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        quizQuestions: {
          select: { id: true, type: true, marks: true },
          orderBy: { order_index: 'asc' },
        },
        _count: { select: { examSessions: true } },
        examSessions: {
          where: { status: 'PENDING_APPROVAL' },
          select: { id: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    const divisions = await prisma.division.findMany({ orderBy: { name: 'asc' } });

    return NextResponse.json({ quizzes, subjects, divisions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch quizzes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  try {
    if (action === 'create_quiz') {
      const {
        title,
        unique_id,
        description,
        instructions,
        subject_name,
        duration_minutes,
        total_marks,
        target_division,
        auto_approve,
        randomize_questions,
        start_time,
        end_time,
        questions,
      } = body;

      if (!title || !title.trim()) {
        return NextResponse.json({ error: 'Quiz title is required' }, { status: 400 });
      }

      // Handle Subject
      let subject_id = body.subject_id;
      if (subject_name && subject_name.trim()) {
        const sName = subject_name.trim();
        let subj = await prisma.subject.findFirst({ where: { name: sName } });
        if (!subj) {
          subj = await prisma.subject.create({
            data: {
              name: sName,
              code: sName.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 15) || 'SUBJ',
            },
          });
        }
        subject_id = subj.id;
      }
      if (!subject_id) {
        let firstSubj = await prisma.subject.findFirst();
        if (!firstSubj) {
          firstSubj = await prisma.subject.create({
            data: { name: 'General', code: 'GEN' },
          });
        }
        subject_id = firstSubj.id;
      }

      // Handle custom unique slug
      let finalUniqueId = '';
      if (unique_id && unique_id.trim()) {
        const cleanedSlug = unique_id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const existing = await prisma.test.findUnique({ where: { unique_id: cleanedSlug } });
        if (existing) {
          return NextResponse.json(
            { error: `The custom link "${cleanedSlug}" is already taken. Please choose another link.` },
            { status: 400 }
          );
        }
        finalUniqueId = cleanedSlug;
      } else {
        const crypto = require('crypto');
        const sName = subject_name || 'quiz';
        const slugBase = sName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 8).replace(/-+$/, '');
        const randomHex = crypto.randomBytes(3).toString('hex');
        finalUniqueId = `quiz-${slugBase || 'test'}-${randomHex}`;
      }

      const teacher_id = payload.user_id;

      const created = await prisma.test.create({
        data: {
          unique_id: finalUniqueId,
          title: title.trim(),
          description: description || null,
          instructions: instructions || null,
          subject_id,
          teacher_id,
          test_type: 'QUIZ',
          auto_approve: auto_approve !== undefined ? Boolean(auto_approve) : true,
          duration_minutes: parseInt(duration_minutes) || 30,
          total_marks: parseInt(total_marks) || (Array.isArray(questions) ? questions.length : 10),
          randomize_questions: Boolean(randomize_questions),
          questions_per_student: Array.isArray(questions) ? questions.length : 10,
          target_division: target_division || null,
          status: 'PUBLISHED',
          start_time: start_time ? new Date(start_time) : null,
          end_time: end_time ? new Date(end_time) : null,
        },
      });

      // If initial questions were provided, insert them
      if (Array.isArray(questions) && questions.length > 0) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await prisma.quizQuestion.create({
            data: {
              test_id: created.id,
              type: q.type || 'MCQ',
              question_text: q.question_text,
              options: Array.isArray(q.options) ? q.options : [],
              correct_answer: q.correct_answer || '',
              alternate_answers: Array.isArray(q.alternate_answers) ? q.alternate_answers : [],
              explanation: q.explanation || null,
              marks: parseFloat(q.marks) || 1,
              order_index: i + 1,
            },
          });
        }
      }

      return NextResponse.json({ success: true, quiz: created });
    }

    if (action === 'update_quiz') {
      const { id, title, unique_id, duration_minutes, total_marks, instructions, target_division, auto_approve, marks_published, status } = body;
      if (!id) return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });

      const updateData: any = {};
      if (title !== undefined) updateData.title = title.trim();
      if (instructions !== undefined) updateData.instructions = instructions;
      if (duration_minutes !== undefined) updateData.duration_minutes = parseInt(duration_minutes);
      if (total_marks !== undefined) updateData.total_marks = parseInt(total_marks);
      if (target_division !== undefined) updateData.target_division = target_division;
      if (auto_approve !== undefined) updateData.auto_approve = Boolean(auto_approve);
      if (marks_published !== undefined) updateData.marks_published = Boolean(marks_published);
      if (status !== undefined) updateData.status = status;

      if (unique_id && unique_id.trim()) {
        const cleanedSlug = unique_id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const existing = await prisma.test.findUnique({ where: { unique_id: cleanedSlug } });
        if (existing && existing.id !== id) {
          return NextResponse.json({ error: `Link "${cleanedSlug}" already in use.` }, { status: 400 });
        }
        updateData.unique_id = cleanedSlug;
      }

      const updated = await prisma.test.update({
        where: { id },
        data: updateData,
      });

      return NextResponse.json({ success: true, quiz: updated });
    }

    if (action === 'delete_quiz') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });

      // Delete questions, answers, sessions, and test
      await prisma.quizQuestion.deleteMany({ where: { test_id: id } });
      await prisma.examSession.deleteMany({ where: { test_id: id } });
      await prisma.test.delete({ where: { id } });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 });
  }
}
