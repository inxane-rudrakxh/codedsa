import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser, teacherScope } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = teacherScope(payload);

  const tests = await prisma.test.findMany({
    where: scope ? { teacher_id: scope } : {},
    include: {
      subject: true,
      teacher: { include: { user: true } },
      testQuestions: {
        include: { question: true },
        orderBy: { order_index: 'asc' }
      },
      _count: { select: { examSessions: true } }
    },
    orderBy: { created_at: 'desc' }
  });
  
  // Teachers see only their own questions; admin sees all
  const allQuestions = await prisma.question.findMany({
    where: scope ? { teacher_id: scope } : {},
    select: { id: true, title: true, topic: true, marks: true },
    orderBy: { created_at: 'asc' }
  });

  const subjects = await prisma.subject.findMany();
  const divisions = await prisma.division.findMany();

  return NextResponse.json({ tests, allQuestions, subjects, divisions });
}

export async function POST(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'create_test') {
    const { title, description, instructions, subject_name, duration_minutes, total_marks, questions_per_student, target_division, allowed_languages, start_time, end_time } = body;
    
    // Always map the created test to the current user (admin)
    const teacher_id = payload.user_id;
    
    // Process Subject by Name
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
    if (!subject_id) return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    
    const crypto = require('crypto');
    // Generate a slug-like unique ID, e.g. test-dsa-5v8f35
    const subjectStr = subject_name || 'test';
    let slugBase = subjectStr.split(/\s+/).map((w: string) => w[0]?.toLowerCase()).join('');
    if (!/^[a-z]+$/.test(slugBase)) {
      slugBase = subjectStr.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 5);
    }
    // ensure trailing - is removed
    slugBase = slugBase.replace(/-+$/, '');
    const randomHex = crypto.randomBytes(3).toString('hex');
    const uniqueId = `test-${slugBase}-${randomHex}`;

    const test = await prisma.test.create({
      data: {
        unique_id: uniqueId,
        title,
        description: description || null,
        instructions: instructions || null,
        subject_id,
        teacher_id,
        duration_minutes: parseInt(duration_minutes) || 60,
        total_marks: parseInt(total_marks) || 30,
        questions_per_student: parseInt(questions_per_student) || 3,
        target_division: target_division || null,
        allowed_languages: allowed_languages || ['c', 'cpp', 'python', 'java'],
        status: 'DRAFT',
        start_time: start_time ? new Date(start_time) : null,
        end_time: end_time ? new Date(end_time) : null,
      }
    });
    return NextResponse.json({ success: true, test });
  }

  if (action === 'update_test') {
    const { id, title, description, instructions, duration_minutes, total_marks, questions_per_student, status, target_division, marks_published, allowed_languages, start_time, end_time } = body;
    
    // Verify ownership
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test || test.teacher_id !== payload.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    await prisma.test.update({
      where: { id },
      data: {
        title,
        description: description || null,
        instructions: instructions || null,
        duration_minutes: parseInt(duration_minutes) || 60,
        total_marks: parseInt(total_marks) || 30,
        questions_per_student: parseInt(questions_per_student) || 3,
        status,
        target_division: target_division || null,
        allowed_languages: allowed_languages || ['c', 'cpp', 'python', 'java'],
        marks_published: marks_published === true,
        start_time: start_time ? new Date(start_time) : null,
        end_time: end_time ? new Date(end_time) : null,
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'publish_marks') {
    const { id } = body;
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test || test.teacher_id !== payload.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    await prisma.test.update({ where: { id }, data: { marks_published: true } });
    return NextResponse.json({ success: true });
  }

  if (action === 'assign_question') {
    const { test_id, question_id } = body;
    const count = await prisma.testQuestion.count({ where: { test_id } });
    await prisma.testQuestion.create({
      data: { test_id, question_id, order_index: count }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'remove_question') {
    const { test_id, question_id } = body;
    await prisma.testQuestion.deleteMany({ where: { test_id, question_id } });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_test') {
    const { id } = body;
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test || test.teacher_id !== payload.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const sessions = await prisma.examSession.findMany({ where: { test_id: id }, select: { id: true } });
    const sessionIds = sessions.map(s => s.id);

    // Delete all related data properly to prevent orphaned documents in MongoDB
    if (sessionIds.length > 0) {
      await prisma.submissionResult.deleteMany({ where: { submission: { session_id: { in: sessionIds } } } });
      await prisma.submission.deleteMany({ where: { session_id: { in: sessionIds } } });
      await prisma.codeDraft.deleteMany({ where: { session_id: { in: sessionIds } } });
      await prisma.assignedQuestion.deleteMany({ where: { session_id: { in: sessionIds } } });
      await prisma.examSession.deleteMany({ where: { test_id: id } });
    }

    await prisma.testQuestion.deleteMany({ where: { test_id: id } });
    await prisma.marksReport.deleteMany({ where: { test_id: id } });
    await prisma.test.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
