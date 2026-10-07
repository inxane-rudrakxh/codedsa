import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const test = await prisma.test.findUnique({
      where: { unique_id: slug },
      include: {
        subject: true,
        testQuestions: true
      }
    });

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

    return NextResponse.json({
      test: {
        id: test.id,
        unique_id: test.unique_id,
        title: test.title,
        duration_minutes: test.duration_minutes,
        total_marks: test.total_marks,
        subject: test.subject.name,
        question_count: test.questions_per_student,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
