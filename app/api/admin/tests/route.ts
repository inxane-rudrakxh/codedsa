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
    const { title, description, subject_id, duration_minutes, total_marks, questions_per_student, target_division, allowed_languages } = body;
    
    // Get teacher id: if teacher, use their own id; if admin and they specify teacher_id, use that
    const teacher_id = payload.role === 'TEACHER' ? payload.user_id : (body.teacher_id || null);
    
    const test = await prisma.test.create({
      data: {
        title,
        description: description || null,
        subject_id,
        teacher_id,
        duration_minutes: parseInt(duration_minutes) || 60,
        total_marks: parseInt(total_marks) || 30,
        questions_per_student: parseInt(questions_per_student) || 3,
        target_division: target_division || null,
        allowed_languages: allowed_languages || ['c', 'cpp', 'python', 'java'],
        status: 'DRAFT'
      }
    });
    return NextResponse.json({ success: true, test });
  }

  if (action === 'update_test') {
    const { id, title, description, duration_minutes, total_marks, questions_per_student, status, target_division, marks_published, allowed_languages } = body;
    
    // Verify ownership if teacher
    if (payload.role === 'TEACHER') {
      const test = await prisma.test.findUnique({ where: { id } });
      if (!test || test.teacher_id !== payload.user_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }
    
    await prisma.test.update({
      where: { id },
      data: {
        title,
        description: description || null,
        duration_minutes: parseInt(duration_minutes) || 60,
        total_marks: parseInt(total_marks) || 30,
        questions_per_student: parseInt(questions_per_student) || 3,
        status,
        target_division: target_division || null,
        allowed_languages: allowed_languages || ['c', 'cpp', 'python', 'java'],
        marks_published: marks_published === true,
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'publish_marks') {
    const { id } = body;
    if (payload.role === 'TEACHER') {
      const test = await prisma.test.findUnique({ where: { id } });
      if (!test || test.teacher_id !== payload.user_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
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
    if (payload.role === 'TEACHER') {
      const test = await prisma.test.findUnique({ where: { id } });
      if (!test || test.teacher_id !== payload.user_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }
    // Delete all related data
    await prisma.examSession.deleteMany({ where: { test_id: id } });
    await prisma.testQuestion.deleteMany({ where: { test_id: id } });
    await prisma.marksReport.deleteMany({ where: { test_id: id } });
    await prisma.test.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
