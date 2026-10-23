import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createStudentSessionToken, generateSessionId } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { roll_no, action, test_id } = body;

  if (!roll_no) {
    return NextResponse.json({ error: 'Roll number is required.' }, { status: 400 });
  }

  if (!test_id) {
    return NextResponse.json({ error: 'Test ID is required.' }, { status: 400 });
  }

  // Lookup test by unique_id
  const test = await prisma.test.findUnique({ where: { unique_id: test_id } });
  if (!test) {
    return NextResponse.json({ error: 'Invalid Test Link or Code.' }, { status: 404 });
  }
  
  if (test.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'This test is not currently active.' }, { status: 403 });
  }

  // Lookup student
  let studentRecord = await prisma.student.findUnique({
    where: { roll_number: roll_no.trim().toUpperCase() },
    include: {
      user: true,
      branch: true,
      division: true
    }
  });

  if (!studentRecord) {
    if (body.name && body.name.trim()) {
      // Auto-register student on the fly (especially helpful for mobile links)
      let defaultBranch = await prisma.branch.findFirst();
      if (!defaultBranch) {
        defaultBranch = await prisma.branch.create({
          data: { code: 'GEN', name: 'General' }
        });
      }
      let defaultDivision = await prisma.division.findFirst();
      if (!defaultDivision) {
        defaultDivision = await prisma.division.create({
          data: { name: 'A' }
        });
      }

      const newUser = await prisma.user.create({
        data: {
          full_name: body.name.trim(),
          role: 'STUDENT',
          status: 'ACTIVE'
        }
      });

      studentRecord = await prisma.student.create({
        data: {
          id: newUser.id,
          roll_number: roll_no.trim().toUpperCase(),
          branch_id: defaultBranch.id,
          division_id: defaultDivision.id
        },
        include: {
          user: true,
          branch: true,
          division: true
        }
      });
    } else {
      return NextResponse.json({ 
        error: 'Roll number not found. Please enter your name to proceed.', 
        need_name: true 
      }, { status: 404 });
    }
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

  if (action === 'request_access') {
    const existingSession = await prisma.examSession.findFirst({
      where: { student_id: studentRecord.id, test_id: test.id },
      orderBy: { start_time: 'desc' }
    });

    let sessionId: string;
    if (existingSession) {
      if (existingSession.is_submitted || existingSession.status === 'EXPIRED') {
        return NextResponse.json({ error: 'You have already completed the assessment.' }, { status: 403 });
      }

      sessionId = existingSession.id;

      const durationMinutes = test?.duration_minutes || 60;
      const startTime = new Date(existingSession.start_time).getTime();
      const elapsed = (Date.now() - startTime) / 1000 / 60;

      if (elapsed >= durationMinutes) {
        await prisma.examSession.update({
          where: { id: sessionId },
          data: { status: 'EXPIRED', is_submitted: true }
        });
        return NextResponse.json({ error: 'Your assessment time has expired.' }, { status: 403 });
      }
      
      // If session exists and is rejected
      if (existingSession.status === 'REJECTED') {
        return NextResponse.json({ error: 'Your access request was rejected. Please contact your teacher.' }, { status: 403 });
      }

      if (existingSession.status === 'ACTIVE') {
        const token = await createStudentSessionToken(studentRecord.id, studentRecord.roll_number, existingSession.id);
        return NextResponse.json({
          success: true,
          status: 'ACTIVE',
          session_token: token,
          test_type: test.test_type || 'CODING',
          student: studentPayload
        });
      }

      // If it exists, just return the current status
      return NextResponse.json({
        success: true,
        status: existingSession.status,
        test_type: test.test_type || 'CODING'
      });
    } else {
      // Validate target division
      if (test.target_division && test.target_division.trim() !== '' && test.target_division !== studentRecord.division?.name) {
         return NextResponse.json({ error: 'This assessment is not assigned to your division.' }, { status: 403 });
      }

      sessionId = generateSessionId();

      const isAutoApprove = Boolean(test.auto_approve);
      const initialStatus = isAutoApprove ? 'ACTIVE' : 'PENDING_APPROVAL';

      await prisma.examSession.create({
        data: {
          id: sessionId,
          test_id: test.id,
          student_id: studentRecord.id,
          status: initialStatus,
          is_submitted: false,
          start_time: new Date()
        }
      });

      if (test.test_type === 'QUIZ') {
        // Quiz test: questions are in QuizQuestion table
        if (isAutoApprove) {
          const token = await createStudentSessionToken(studentRecord.id, studentRecord.roll_number, sessionId);
          return NextResponse.json({
            success: true,
            status: 'ACTIVE',
            session_token: token,
            test_type: 'QUIZ',
            student: studentPayload
          });
        }

        return NextResponse.json({
          success: true,
          status: 'PENDING_APPROVAL',
          test_type: 'QUIZ'
        });
      }

      // Assign questions deterministically without duplicates for coding test
      const testQuestions = await prisma.testQuestion.findMany({
        where: { test_id: test.id },
        orderBy: { order_index: 'asc' }
      });

      // Guarantee unique questions only
      const uniqueTestQuestions: typeof testQuestions = [];
      const seenQIds = new Set<string>();
      for (const tq of testQuestions) {
        if (!seenQIds.has(tq.question_id)) {
          seenQIds.add(tq.question_id);
          uniqueTestQuestions.push(tq);
        }
      }
      
      const totalAvailable = uniqueTestQuestions.length;
      const k = Math.min(test.questions_per_student || 3, totalAvailable);

      if (totalAvailable > 0 && k > 0) {

        // ── Per-roll-number question overrides ────────────────────────────────
        // Maps a roll number to a fixed list of 1-based question positions.
        // These students bypass the category algorithm and always receive the
        // exact questions at the specified positions (in order).
        const ROLL_OVERRIDES: Record<string, number[]> = {
          'AD1315': [3, 8, 5],
        };

        const overridePositions = ROLL_OVERRIDES[studentRecord.roll_number.toUpperCase()];

        const assigned: typeof uniqueTestQuestions = [];
        const assignedIds = new Set<string>();

        if (overridePositions) {
          // Use the explicit positions for this student
          for (const pos of overridePositions) {
            const q = uniqueTestQuestions[pos - 1];
            if (q && !assignedIds.has(q.question_id)) {
              assignedIds.add(q.question_id);
              assigned.push(q);
            }
          }
        } else {
          // ── Category-based assignment ───────────────────────────────────────
          // Questions in the test are split into 3 fixed categories by their
          // 1-based position (order_index rank) among uniqueTestQuestions:
          //   Category 1 → positions 1, 2, 8, 9
          //   Category 2 → positions 3, 4
          //   Category 3 → positions 5, 6, 7
          // One question is picked from each category using a deterministic seed
          // derived from the student's roll number so the result is stable on reconnect.

          const rollSeed = studentRecord.roll_number
            .split('')
            .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);

          const CATEGORY_POSITIONS: number[][] = [
            [1, 2, 8, 9],  // Category 1
            [3, 4],        // Category 2
            [5, 6, 7],     // Category 3
          ];

          for (let catIdx = 0; catIdx < CATEGORY_POSITIONS.length; catIdx++) {
            const positions = CATEGORY_POSITIONS[catIdx];
            const pool = positions
              .map((pos: number) => uniqueTestQuestions[pos - 1])
              .filter((q: typeof uniqueTestQuestions[number] | undefined): q is typeof uniqueTestQuestions[number] =>
                q !== undefined && !assignedIds.has(q.question_id)
              );
            if (pool.length === 0) continue;
            const pick = pool[Math.abs(rollSeed + catIdx * 31) % pool.length];
            assignedIds.add(pick.question_id);
            assigned.push(pick);
          }

          // Fallback: if a category was empty, fill remaining slots with any unassigned question
          const kTarget = test.questions_per_student || 3;
          if (assigned.length < kTarget) {
            for (const q of uniqueTestQuestions) {
              if (!assignedIds.has(q.question_id)) {
                assignedIds.add(q.question_id);
                assigned.push(q);
                if (assigned.length === kTarget) break;
              }
            }
          }
        }

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

    return NextResponse.json({
      success: true,
      status: 'PENDING_APPROVAL'
    });
  }

  if (action === 'check_status') {
    const existingSession = await prisma.examSession.findFirst({
      where: { student_id: studentRecord.id, test_id: test.id },
      orderBy: { start_time: 'desc' }
    });

    if (!existingSession) {
      return NextResponse.json({ status: 'NOT_FOUND' });
    }

    if (existingSession.status === 'ACTIVE') {
      const token = await createStudentSessionToken(studentRecord.id, studentRecord.roll_number, existingSession.id);
      return NextResponse.json({ status: 'ACTIVE', session_token: token, student: studentPayload, test_type: test.test_type || 'CODING' });
    }

    return NextResponse.json({ status: existingSession.status });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
