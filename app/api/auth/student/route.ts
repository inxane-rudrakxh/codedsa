import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createStudentSessionToken, generateSessionId } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { roll_no, action } = body;

  if (!roll_no) {
    return NextResponse.json({ error: 'Roll number is required.' }, { status: 400 });
  }

  // Check exam is active via settings
  const examActive = await prisma.setting.findUnique({ where: { key: 'exam_active' } });
  if (examActive && examActive.value === '0') {
    return NextResponse.json({ error: 'The exam is not currently active.' }, { status: 403 });
  }

  // Lookup student
  const studentRecord = await prisma.student.findUnique({
    where: { roll_number: roll_no.trim().toUpperCase() },
    include: {
      user: true,
      branch: true,
      division: true
    }
  });

  if (!studentRecord) {
    return NextResponse.json({ error: 'Roll number not found.' }, { status: 404 });
  }

  if (!studentRecord.user || studentRecord.user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account disabled.' }, { status: 403 });
  }

  const studentPayload = {
    roll_no: studentRecord.roll_number,
    name: studentRecord.user.full_name,
    division: studentRecord.division?.name || 'A',
    branch: studentRecord.branch?.name || 'AI&DS',
  };

  if (action === 'lookup') {
    return NextResponse.json({ student: studentPayload });
  }

  if (action === 'login') {
    const existingSession = await prisma.examSession.findFirst({
      where: { student_id: studentRecord.id },
      orderBy: { start_time: 'desc' }
    });

    let sessionId: string;
    if (existingSession) {
      if (existingSession.is_submitted || existingSession.status === 'EXPIRED') {
        return NextResponse.json({ error: 'You have already completed the exam.' }, { status: 403 });
      }

      sessionId = existingSession.id;

      const testInfo = await prisma.test.findUnique({ where: { id: existingSession.test_id } });
      const durationMinutes = testInfo?.duration_minutes || 60;
      const startTime = new Date(existingSession.start_time).getTime();
      const elapsed = (Date.now() - startTime) / 1000 / 60;

      if (elapsed >= durationMinutes) {
        await prisma.examSession.update({
          where: { id: sessionId },
          data: { status: 'EXPIRED', is_submitted: true }
        });
        return NextResponse.json({ error: 'Your exam time has expired.' }, { status: 403 });
      }
    } else {
      // Fetch tests that are PUBLISHED and either have no target_division or match the student's division
      const activeTest = await prisma.test.findFirst({
        where: { 
          status: 'PUBLISHED',
          OR: [
            { target_division: null },
            { target_division: '' },
            { target_division: studentRecord.division?.name }
          ]
        },
        orderBy: { id: 'desc' }
      });

      if (!activeTest) {
        return NextResponse.json({ error: 'No active test found.' }, { status: 404 });
      }

      sessionId = generateSessionId();

      await prisma.examSession.create({
        data: {
          id: sessionId,
          test_id: activeTest.id,
          student_id: studentRecord.id,
          status: 'PENDING_APPROVAL',
          is_submitted: false
        }
      });

      // Assign questions
      const testQuestions = await prisma.testQuestion.findMany({
        where: { test_id: activeTest.id }
      });
      
      if (testQuestions.length > 0) {
        let qs = [...testQuestions];
        for (let i = qs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [qs[i], qs[j]] = [qs[j], qs[i]];
        }
        const assigned = qs.slice(0, activeTest.questions_per_student || 3);

        if (assigned.length > 0) {
          await prisma.assignedQuestion.createMany({
            data: assigned.map((q, index) => ({
              session_id: sessionId,
              question_id: q.question_id,
              order_index: index + 1
            }))
          });

          const CPP_LANG_ID = 1;
          const starterCode = `#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}`;
          await prisma.codeDraft.createMany({
            data: assigned.map(q => ({
              session_id: sessionId,
              question_id: q.question_id,
              language_id: CPP_LANG_ID,
              source_code: starterCode
            }))
          });
        }
      }
    }

    const token = await createStudentSessionToken(studentRecord.id, studentRecord.roll_number, sessionId);

    return NextResponse.json({
      session_token: token,
      student: studentPayload,
    });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
