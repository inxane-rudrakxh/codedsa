import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password, role } = body; 

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required.' }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email: identifier } });

    if (!user) {
      // Student login via roll number
      const studentRecord = await prisma.student.findUnique({
        where: { roll_number: identifier.toUpperCase() },
        include: { user: true }
      });
      if (studentRecord) {
        user = studentRecord.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // If role is specified, enforce it (e.g. admin page passes role: 'ADMIN' or 'TEACHER')
    if (role && role === 'ADMIN') {
      // Admin login page accepts both ADMIN and TEACHER roles
      if (user.role !== 'ADMIN' && user.role !== 'TEACHER') {
        return NextResponse.json({ error: 'Unauthorized role.' }, { status: 403 });
      }
    } else if (role && role === 'STUDENT') {
      if (user.role !== 'STUDENT') {
        return NextResponse.json({ error: 'Unauthorized role.' }, { status: 403 });
      }
    }

    const valid = user.password_hash ? await verifyPassword(password, user.password_hash) : false;
    if (!valid) { 
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is disabled.' }, { status: 403 });
    }

    const authToken = await createAuthToken(user.id, user.role, user.email || '');

    let responsePayload: any = {
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    };

    if (user.role === 'STUDENT') {
      const studentRecord = await prisma.student.findUnique({ where: { id: user.id } });
      responsePayload.user.roll_number = studentRecord?.roll_number;
    }

    if (user.role === 'TEACHER') {
      const teacherRecord = await prisma.teacher.findUnique({ where: { id: user.id } });
      responsePayload.user.department = teacherRecord?.department;
      responsePayload.user.subject = teacherRecord?.subject;
    }

    return NextResponse.json(responsePayload);

  } catch (err: any) {
    console.error('Auth Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
