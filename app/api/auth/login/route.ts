import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password, role, firebaseToken } = body; 

    let user;

    if (firebaseToken) {
      // Firebase OTP flow
      try {
        const { adminAuth } = await import('@/lib/firebase-admin');
        const decodedToken = await adminAuth.verifyIdToken(firebaseToken);
        const email = decodedToken.email;
        if (!email) {
          return NextResponse.json({ error: 'Firebase token did not contain an email.' }, { status: 400 });
        }
        if (!decodedToken.email_verified) {
          return NextResponse.json({ error: 'Email is not verified.' }, { status: 403 });
        }
        user = await prisma.user.findFirst({ where: { email } });
        if (!user) {
          return NextResponse.json({ error: 'No faculty found with this email.' }, { status: 404 });
        }
      } catch (err) {
        console.error('Firebase token verification failed', err);
        return NextResponse.json({ error: 'Invalid or expired Firebase token.' }, { status: 401 });
      }
    } else if (identifier === 'admin@zcoer.edu.in' && password === 'admin123') {
      // TEST ACCOUNT BYPASS
      user = await prisma.user.findUnique({ where: { email: identifier } });
      if (!user) {
        const { hashPassword } = await import('@/lib/auth');
        const hashed = await hashPassword('admin123');
        user = await prisma.user.create({
          data: {
            email: identifier,
            password_hash: hashed,
            full_name: 'Test Admin',
            role: 'ADMIN',
            status: 'ACTIVE',
          }
        });
      }
    } else {
      // Legacy or Student password login
      if (!identifier || !password) {
        return NextResponse.json({ error: 'Identifier and password are required.' }, { status: 400 });
      }

      user = await prisma.user.findUnique({ where: { email: identifier } });

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

      const valid = user.password_hash ? await verifyPassword(password, user.password_hash) : false;
      if (!valid) { 
        return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
      }
    }

    // If role is specified, enforce it
    if (role && role === 'ADMIN') {
      if (user.role !== 'ADMIN' && user.role !== 'TEACHER') {
        return NextResponse.json({ error: 'Unauthorized role.' }, { status: 403 });
      }
    } else if (role && role === 'STUDENT') {
      if (user.role !== 'STUDENT') {
        return NextResponse.json({ error: 'Unauthorized role.' }, { status: 403 });
      }
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
