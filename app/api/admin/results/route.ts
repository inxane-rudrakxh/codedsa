import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser, teacherScope } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const test_id = url.searchParams.get('test_id');

  // Results scoped to test if specified, otherwise all tests for this teacher
  const scope = teacherScope(payload);

  if (test_id) {
    // Results for specific test
    const test = await prisma.test.findUnique({ where: { id: test_id } });
    if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 });

    // Check teacher owns this test
    if (test.teacher_id !== payload.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const students = await prisma.student.findMany({
      where: {
        user: { status: 'ACTIVE' },
        ...(test.target_division ? { division: { name: test.target_division } } : {})
      },
      include: { user: true, branch: true, division: true },
      orderBy: { roll_number: 'asc' }
    });

    const sessions = await prisma.examSession.findMany({
      where: { test_id },
      include: {
        assignedQuestions: { include: { question: true }, orderBy: { order_index: 'asc' } },
        submissions: { orderBy: { created_at: 'desc' } },
        codeDrafts: true
      }
    });

    const results = students.map(student => {
      const session = sessions.find(s => s.student_id === student.id);
      const questionsData: any[] = [];
      let total_score = 0;

      if (session) {
        for (const aq of session.assignedQuestions) {
          // Get the latest submission for this question
          const subs = session.submissions.filter(s => s.question_id === aq.question_id);
          const sub = subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          const draft = session.codeDrafts?.find((d: any) => d.question_id === aq.question_id);
          const marks = sub?.marks_awarded ?? null;
          if (marks !== null) total_score += marks;
          questionsData.push({
            question_id: aq.question_id,
            question_title: aq.question.title,
            order_index: aq.order_index,
            submission_id: sub?.id || null,
            source_code: sub?.source_code || draft?.source_code || null,
            status: sub?.status || (draft ? 'DRAFT' : null),
            passed_test_cases: sub?.passed_test_cases ?? null,
            total_test_cases: sub?.total_test_cases ?? null,
            marks_awarded: marks,
            max_marks: aq.question.marks,
            ai_feedback: sub?.error_message || null,
          });
        }
      }

      return {
        roll_no: student.roll_number,
        name: student.user.full_name,
        division: student.division?.name || '',
        branch: student.branch?.name || 'AI&DS',
        session_id: session?.id || null,
        status: session?.status || null,
        is_submitted: session?.is_submitted ? 1 : 0,
        start_time: session?.start_time || null,
        end_time: session?.end_time || null,
        integrity_warnings: session?.integrity_warnings || 0,
        questions: questionsData,
        total_score,
        max_total: test.total_marks,
      };
    });

    return NextResponse.json({ results, test });
  }

  // Summary across all tests for this teacher
  const tests = await prisma.test.findMany({
    where: scope ? { teacher_id: scope } : {},
    include: {
      subject: true,
      _count: { select: { examSessions: true } }
    },
    orderBy: { created_at: 'desc' }
  });

  return NextResponse.json({ tests });
}

export async function POST(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'update_marks') {
    const { submission_id, session_id, question_id, marks_awarded } = body;
    if (marks_awarded === undefined) {
      return NextResponse.json({ error: 'Missing marks_awarded' }, { status: 400 });
    }
    
    if (submission_id) {
      await prisma.submission.update({
        where: { id: submission_id },
        data: { marks_awarded: parseFloat(marks_awarded) }
      });
    } else if (session_id && question_id) {
      // Find draft
      const draft = await prisma.codeDraft.findUnique({
        where: { session_id_question_id: { session_id, question_id } }
      });
      await prisma.submission.create({
        data: {
          session_id,
          question_id,
          language_id: draft?.language_id || 1,
          source_code: draft?.source_code || '',
          status: 'MANUALLY_GRADED',
          marks_awarded: parseFloat(marks_awarded)
        }
      });
    } else {
      return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  }

  if (action === 'generate_report') {
    const { test_id } = body;
    const test = await prisma.test.findUnique({ where: { id: test_id } });
    if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 });

    if (test.teacher_id !== payload.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const students = await prisma.student.findMany({
      where: {
        user: { status: 'ACTIVE' },
        ...(test.target_division ? { division: { name: test.target_division } } : {})
      },
      include: { user: true, branch: true, division: true },
      orderBy: { roll_number: 'asc' }
    });

    const sessions = await prisma.examSession.findMany({
      where: { test_id },
      include: {
        assignedQuestions: { include: { question: true }, orderBy: { order_index: 'asc' } },
        submissions: true
      }
    });

    const reportRows = students.map(student => {
      const session = sessions.find(s => s.student_id === student.id);
      let total_score = 0;
      const qScores: Record<string, number | null> = {};

      if (session) {
        for (const aq of session.assignedQuestions) {
          const subs = session.submissions.filter(s => s.question_id === aq.question_id);
          const sub = subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          const marks = sub?.marks_awarded ?? null;
          if (marks !== null) total_score += marks;
          qScores[`Q${aq.order_index + 1}`] = marks;
        }
      }

      return {
        roll_no: student.roll_number,
        name: student.user.full_name,
        division: student.division?.name || '',
        status: session?.is_submitted ? 'SUBMITTED' : (session ? 'IN_PROGRESS' : 'NOT_STARTED'),
        ...qScores,
        total: session?.is_submitted ? total_score : null,
        out_of: test.total_marks,
      };
    });

    const report = await prisma.marksReport.create({
      data: {
        test_id,
        generated_by: payload.user_id,
        data: JSON.stringify({ test_title: test.title, generated_at: new Date().toISOString(), rows: reportRows })
      }
    });

    return NextResponse.json({ success: true, report_id: report.id, data: reportRows });
  }

  if (action === 'reset_session') {
    const { session_id } = body;
    if (!session_id) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    
    try {
      const session = await prisma.examSession.findUnique({
        where: { id: session_id },
        include: { test: true }
      });
      if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

      // Verify ownership
      if (session.test.teacher_id !== payload.user_id) {
        return NextResponse.json({ error: 'Access denied. You can only reset sessions for tests you created.' }, { status: 403 });
      }

      await prisma.$transaction([
        // Delete submission results
        prisma.submissionResult.deleteMany({
          where: { submission: { session_id } }
        }),
        prisma.submission.deleteMany({ where: { session_id } }),
        prisma.codeDraft.deleteMany({ where: { session_id } }),
        prisma.assignedQuestion.deleteMany({ where: { session_id } }),
        prisma.examSession.delete({ where: { id: session_id } })
      ]);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
