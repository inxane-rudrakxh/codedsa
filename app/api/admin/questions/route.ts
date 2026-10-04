import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser, teacherScope } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = teacherScope(payload);

  const questions = await prisma.question.findMany({
    where: scope ? { teacher_id: scope } : {},
    include: {
      testCases: { orderBy: { order_index: 'asc' } },
      subject: true,
    },
    orderBy: { created_at: 'desc' }
  });

  const subjects = await prisma.subject.findMany();
  
  return NextResponse.json({ questions, subjects });
}

export async function POST(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'create') {
    const { title, topic, description, input_format, output_format, constraints, sample_input, sample_output, explanation, marks, difficulty, subject_id } = body;
    
    if (!title || !description || !subject_id) {
      return NextResponse.json({ error: 'title, description, and subject_id are required' }, { status: 400 });
    }

    // Teacher gets a unique slug based on their id+timestamp
    const teacher_id = payload.role === 'TEACHER' ? payload.user_id : null;
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
    
    // Verify ownership if teacher
    if (payload.role === 'TEACHER') {
      const q = await prisma.question.findUnique({ where: { id } });
      if (!q || q.teacher_id !== payload.user_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
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
    if (payload.role === 'TEACHER') {
      const q = await prisma.question.findUnique({ where: { id } });
      if (!q || q.teacher_id !== payload.user_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }
    await prisma.testCase.deleteMany({ where: { question_id: id } });
    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }

  if (action === 'add_test_case') {
    const { question_id, input, expected_output, is_hidden, marks } = body;
    const count = await prisma.testCase.count({ where: { question_id } });
    await prisma.testCase.create({
      data: {
        question_id,
        input,
        expected_output,
        is_hidden: is_hidden || false,
        marks: parseInt(marks) || 1,
        order_index: count,
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_test_case') {
    await prisma.testCase.delete({ where: { id: body.id } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
