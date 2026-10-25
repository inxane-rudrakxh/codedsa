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
    const test = await prisma.test.findUnique({
      where: { id: test_id },
      include: {
        testQuestions: {
          include: { question: true },
          orderBy: { order_index: 'asc' }
        }
      }
    });
    if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 });

    // Check teacher owns this test
    if (test.teacher_id !== payload.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const targetDivision = test.target_division || test.title.match(/Div\s*-\s*([A-Za-z0-9]+)/i)?.[1]?.toUpperCase() || null;
    const students = await prisma.student.findMany({
      where: {
        user: { status: 'ACTIVE' },
        ...(targetDivision ? { division: { name: targetDivision } } : {})
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
      let questionsData: any[] = [];
      let total_score = 0;

      if (session) {
        for (let qi = 0; qi < session.assignedQuestions.length; qi++) {
          const aq = session.assignedQuestions[qi];
          // Get the latest submission for this question
          const subs = session.submissions.filter(s => s.question_id === aq.question_id);
          const sub = subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          const draft = session.codeDrafts?.find((d: any) => d.question_id === aq.question_id);
          const marks = sub?.marks_awarded ?? null;
          if (marks !== null && marks !== undefined) total_score += marks;
          questionsData.push({
            question_id: aq.question_id,
            question_title: aq.question.title,
            order_index: qi + 1,
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
      } else if (test.testQuestions && test.testQuestions.length > 0) {
        const qCount = test.questions_per_student || 3;
        questionsData = test.testQuestions.slice(0, qCount).map((tq, qi) => ({
          question_id: tq.question_id,
          question_title: tq.question.title,
          order_index: qi + 1,
          submission_id: null,
          source_code: null,
          status: null,
          passed_test_cases: null,
          total_test_cases: null,
          marks_awarded: null,
          max_marks: tq.question.marks,
          ai_feedback: null,
        }));
      }

      const hasMarks = questionsData.some(q => q.marks_awarded !== null && q.marks_awarded !== undefined);
      const isSubmitted = (session?.is_submitted || hasMarks) ? 1 : 0;

      if (session && !session.is_submitted && hasMarks) {
        prisma.examSession.update({
          where: { id: session.id },
          data: { is_submitted: true, status: 'COMPLETED' }
        }).catch(() => {});
      }

      return {
        student_id: student.id,
        roll_no: student.roll_number,
        name: student.user.full_name,
        division: student.division?.name || '',
        branch: student.branch?.name || 'AI&DS',
        session_id: session?.id || null,
        status: session?.status === 'STOPPED' ? 'STOPPED' : (isSubmitted ? 'SUBMITTED' : (session?.status || null)),
        is_submitted: isSubmitted,
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
    const { submission_id, session_id, question_id, marks_awarded, student_id, test_id } = body;
    if (marks_awarded === undefined) {
      return NextResponse.json({ error: 'Missing marks_awarded' }, { status: 400 });
    }
    
    const parsedMarks = parseFloat(marks_awarded) || 0;
    let targetSessionId = session_id;

    if (submission_id) {
      const submission = await prisma.submission.findUnique({
        where: { id: submission_id },
        include: { session: { include: { test: true } } }
      });
      if (!submission || (payload.role !== 'ADMIN' && submission.session.test.teacher_id !== payload.user_id)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      targetSessionId = submission.session_id;

      await prisma.submission.update({
        where: { id: submission_id },
        data: {
          marks_awarded: parsedMarks,
          status: 'MANUALLY_GRADED'
        }
      });
    } else if (session_id && question_id) {
      const session = await prisma.examSession.findUnique({
        where: { id: session_id },
        include: { test: true }
      });
      if (!session || (payload.role !== 'ADMIN' && session.test.teacher_id !== payload.user_id)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      targetSessionId = session_id;

      // Check if submission already exists for this session & question
      const existingSub = await prisma.submission.findFirst({
        where: { session_id, question_id },
        orderBy: { created_at: 'desc' }
      });

      if (existingSub) {
        await prisma.submission.update({
          where: { id: existingSub.id },
          data: {
            marks_awarded: parsedMarks,
            status: 'MANUALLY_GRADED'
          }
        });
      } else {
        // Find draft if any
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
            marks_awarded: parsedMarks,
            total_test_cases: 0,
            passed_test_cases: 0
          }
        });
      }
    } else if (student_id && test_id && question_id) {
      const test = await prisma.test.findUnique({ where: { id: test_id } });
      if (!test || (payload.role !== 'ADMIN' && test.teacher_id !== payload.user_id)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Check or create ExamSession for this student
      let session = await prisma.examSession.findFirst({
        where: { student_id, test_id }
      });

      if (!session) {
        session = await prisma.examSession.create({
          data: {
            test_id,
            student_id,
            status: 'COMPLETED',
            is_submitted: true,
            end_time: new Date()
          }
        });

        // Assign questions
        const testQuestions = await prisma.testQuestion.findMany({
          where: { test_id },
          orderBy: { order_index: 'asc' },
          take: test.questions_per_student || 3
        });
        if (testQuestions.length > 0) {
          await prisma.assignedQuestion.createMany({
            data: testQuestions.map((tq, idx) => ({
              session_id: session!.id,
              question_id: tq.question_id,
              order_index: idx + 1
            }))
          });
        }
      }

      targetSessionId = session.id;

      const existingSub = await prisma.submission.findFirst({
        where: { session_id: session.id, question_id },
        orderBy: { created_at: 'desc' }
      });

      if (existingSub) {
        await prisma.submission.update({
          where: { id: existingSub.id },
          data: {
            marks_awarded: parsedMarks,
            status: 'MANUALLY_GRADED'
          }
        });
      } else {
        await prisma.submission.create({
          data: {
            session_id: session.id,
            question_id,
            language_id: 1,
            source_code: '',
            status: 'MANUALLY_GRADED',
            marks_awarded: parsedMarks,
            total_test_cases: 0,
            passed_test_cases: 0
          }
        });
      }
    } else {
      return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 });
    }
    
    // Automatically change paper status to Submitted!
    if (targetSessionId) {
      await prisma.examSession.update({
        where: { id: targetSessionId },
        data: {
          is_submitted: true,
          status: 'COMPLETED',
          end_time: new Date()
        }
      });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'generate_report') {
    const { test_id } = body;
    const test = await prisma.test.findUnique({ where: { id: test_id } });
    if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 });

    if (payload.role !== 'ADMIN' && test.teacher_id !== payload.user_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const targetDivision = test.target_division || test.title.match(/Div\s*-\s*([A-Za-z0-9]+)/i)?.[1]?.toUpperCase() || null;
    const students = await prisma.student.findMany({
      where: {
        user: { status: 'ACTIVE' },
        ...(targetDivision ? { division: { name: targetDivision } } : {})
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
        for (let qi = 0; qi < session.assignedQuestions.length; qi++) {
          const aq = session.assignedQuestions[qi];
          const subs = session.submissions.filter(s => s.question_id === aq.question_id);
          const sub = subs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          const marks = sub?.marks_awarded ?? null;
          if (marks !== null && marks !== undefined) total_score += marks;
          qScores[`Q${qi + 1}`] = marks;
        }
      }

      const hasMarks = Object.values(qScores).some(m => m !== null && m !== undefined);
      const isSubmitted = Boolean(session?.is_submitted || hasMarks || total_score > 0);

      return {
        roll_no: student.roll_number,
        name: student.user.full_name,
        division: student.division?.name || '',
        status: session?.status === 'STOPPED' ? 'STOPPED' : (isSubmitted ? 'SUBMITTED' : (session ? 'IN_PROGRESS' : 'ABSENT')),
        ...qScores,
        total: isSubmitted ? total_score : 0,
        out_of: test.total_marks,
        percentage: isSubmitted && test.total_marks > 0 ? `${((total_score / test.total_marks) * 100).toFixed(1)}%` : '0.0%',
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

  if (action === 'stop_session' || action === 'stop_sessions') {
    const sessionIds: string[] = Array.isArray(body.session_ids)
      ? body.session_ids
      : (body.session_id ? [body.session_id] : []);

    if (sessionIds.length === 0) {
      return NextResponse.json({ error: 'Missing session_id or session_ids' }, { status: 400 });
    }

    try {
      const sessions = await prisma.examSession.findMany({
        where: { id: { in: sessionIds } },
        include: { test: true }
      });

      if (sessions.length === 0) {
        return NextResponse.json({ error: 'No matching sessions found' }, { status: 404 });
      }

      for (const s of sessions) {
        if (payload.role !== 'ADMIN' && s.test.teacher_id !== payload.user_id) {
          return NextResponse.json({ error: 'Access denied for one or more sessions' }, { status: 403 });
        }
      }

      await prisma.examSession.updateMany({
        where: { id: { in: sessionIds } },
        data: {
          status: 'STOPPED',
          is_submitted: true,
          end_time: new Date()
        }
      });

      return NextResponse.json({ success: true, count: sessionIds.length });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  if (action === 'stop_all') {
    const { test_id } = body;
    if (!test_id) return NextResponse.json({ error: 'Missing test_id' }, { status: 400 });

    try {
      const test = await prisma.test.findUnique({ where: { id: test_id } });
      if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 });

      if (payload.role !== 'ADMIN' && test.teacher_id !== payload.user_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const res = await prisma.examSession.updateMany({
        where: {
          test_id,
          is_submitted: false,
          status: { notIn: ['STOPPED', 'COMPLETED', 'EXPIRED'] }
        },
        data: {
          status: 'STOPPED',
          is_submitted: true,
          end_time: new Date()
        }
      });

      return NextResponse.json({ success: true, count: res.count });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
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
      if (payload.role !== 'ADMIN' && session.test.teacher_id !== payload.user_id) {
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
