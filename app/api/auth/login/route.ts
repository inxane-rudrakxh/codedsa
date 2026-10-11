import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, createAuthToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimiter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password, role, firebaseToken } = body; 

    // Apply rate limiting (10 attempts per 5 minutes per IP/identifier)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const rateLimitKey = `login:${ip}:${(identifier || '').toLowerCase()}`;
    const rateCheck = checkRateLimit(rateLimitKey, 10, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again in 5 minutes.' },
        { status: 429 }
      );
    }

    let user;

    if (firebaseToken) {
      // Firebase authentication flow
      try {
        const { adminAuth } = await import('@/lib/firebase-admin');
        const decodedToken = await adminAuth.verifyIdToken(firebaseToken);
        const email = decodedToken.email;
        if (!email) {
          return NextResponse.json({ error: 'Firebase authentication did not contain an email.' }, { status: 400 });
        }
        
        user = await prisma.user.findFirst({ 
          where: { email: email.toLowerCase() } 
        });

        if (!user) {
          return NextResponse.json({ error: 'No faculty account found with this email. Please sign up first.' }, { status: 404 });
        }

        // If email not verified in Firebase, check password if provided as fallback
        if (!decodedToken.email_verified && password) {
          const valid = user.password_hash ? await verifyPassword(password, user.password_hash) : false;
          if (!valid) {
            return NextResponse.json({ 
              error: 'Your email is not verified yet. Please check your inbox or verify your account.' 
            }, { status: 403 });
          }
        }
      } catch (err: any) {
        console.error('Firebase token verification notice:', err.message);
        // If Firebase token expired/failed, but user provided identifier + password, fallback to password check
        if (!identifier && !password) {
          return NextResponse.json({ error: 'Invalid or expired authentication session. Please log in again.' }, { status: 401 });
        }
      }
    }

    // Direct password authentication (if not already authenticated by Firebase)
    if (!user) {
      if (!identifier || !password) {
        return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
      }

      const cleanId = identifier.trim();
      user = await prisma.user.findFirst({ 
        where: { 
          OR: [
            { email: cleanId.toLowerCase() },
            { email: cleanId }
          ]
        } 
      });

      if (!user) {
        // Student login via roll number
        const studentRecord = await prisma.student.findUnique({
          where: { roll_number: cleanId.toUpperCase() },
          include: { user: true }
        });
        if (studentRecord) {
          user = studentRecord.user;
        }
      }

      if (!user) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      const valid = user.password_hash ? await verifyPassword(password, user.password_hash) : false;
      if (!valid) { 
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
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
