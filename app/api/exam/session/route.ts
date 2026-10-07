import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  // Get session
  const sessionData = await prisma.examSession.findUnique({
    where: { id: payload.session_id },
    include: {
      test: true,
      student: {
        include: { user: true, branch: true, division: true }
      }
    }
  });

  if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  let session = sessionData;

  // Check if session expired
  const durationMinutes = session.test.duration_minutes || 60;
  const startTime = new Date(session.start_time).getTime();
  const elapsed = (Date.now() - startTime) / 1000; // seconds
  const remaining = Math.max(0, durationMinutes * 60 - elapsed);

  if (remaining <= 0 && session.status !== 'EXPIRED' && !session.is_submitted) {
    await prisma.examSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED', is_submitted: true }
    });
    session.status = 'EXPIRED';
    session.is_submitted = true;
  }

  // Get assigned questions
  const assignedRows = await prisma.assignedQuestion.findMany({
    where: { session_id: session.id },
    include: { question: true },
    orderBy: { order_index: 'asc' }
  });

  const formattedQuestions = assignedRows.map(r => ({
    ...r.question,
    order_index: r.order_index
  }));

  // Get submissions
  const submissionRows = await prisma.submission.findMany({
    where: { session_id: session.id }
  });
  const submissions: Record<string, any> = {};
  submissionRows.forEach(s => { 
    if (!session.test.marks_published) {
      // Hide marks and AI feedback if not published
      const { marks_awarded, ai_feedback, ...rest } = s;
      submissions[s.question_id] = rest;
    } else {
      submissions[s.question_id] = s; 
    }
  });

  // Get code saves
  const saveRows = await prisma.codeDraft.findMany({
    where: { session_id: session.id }
  });
  const saves: Record<string, string> = {};
  saveRows.forEach(s => { if(s.source_code) saves[s.question_id] = s.source_code; });

  // Get visible test cases
  const testCases: Record<string, any[]> = {};
  if (formattedQuestions.length > 0) {
    const questionIds = formattedQuestions.map(q => q.id);
    const casesData = await prisma.testCase.findMany({
      where: {
        is_hidden: false,
        question_id: { in: questionIds }
      },
      select: { question_id: true, input: true, expected_output: true }
    });
    
    formattedQuestions.forEach(q => { testCases[q.id] = []; });
    casesData.forEach(c => {
      if (testCases[c.question_id]) {
        testCases[c.question_id].push(c);
      }
    });
  }

  return NextResponse.json({
    session: {
      id: session.id,
      start_time: session.start_time,
      status: session.status === 'PENDING_APPROVAL' ? 'pending_approval' : (session.is_submitted ? 'submitted' : session.status.toLowerCase()),
      is_submitted: session.is_submitted,
      remaining_seconds: Math.floor(remaining),
      test_title: session.test.title,
      test_instructions: session.test.instructions || '',
      marks_published: session.test.marks_published,
      allowed_languages: session.test.allowed_languages,
    },
    student: {
      roll_no: session.student.roll_number,
      name: session.student.user.full_name,
      branch: session.student.branch?.name,
      division: session.student.division?.name
    },
    questions: formattedQuestions,
    submissions,
    saves,
    testCases,
  });
}
