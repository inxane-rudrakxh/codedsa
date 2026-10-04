import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (payload && payload.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const questions = await prisma.question.findMany({
    include: { testCases: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' }
  });
  
  // Format to match old UI expectations
  const formatted = questions.map(q => ({
    ...q,
    statement: q.description,
    example_input: q.sample_input,
    example_output: q.sample_output,
    is_enabled: 1, // dummy for old UI
    test_cases: q.testCases.map((tc: any) => ({
      ...tc,
      is_visible: !tc.is_hidden ? 1 : 0,
      weight: tc.marks,
      type: 'hidden'
    }))
  }));

  return NextResponse.json({ questions: formatted });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (payload && payload.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'toggle') {
    // V2 doesn't use is_enabled, so just return success
    return NextResponse.json({ success: true });
  }

  if (action === 'update') {
    const { id, title, topic, statement, input_format, output_format, constraints, example_input, example_output } = body;
    await prisma.question.update({
      where: { id: id },
      data: {
        title, topic, description: statement, input_format, output_format, constraints, sample_input: example_input, sample_output: example_output
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'add_test_case') {
    const { question_id, input, expected_output, is_visible, weight } = body;
    await prisma.testCase.create({
      data: {
        question_id: question_id,
        input,
        expected_output,
        is_hidden: !is_visible,
        marks: weight || 1
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
