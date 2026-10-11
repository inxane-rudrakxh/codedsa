import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, createAuthToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimiter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, department, subject, firebaseToken } = body;

    // Rate limit signup attempts (5 per 15 minutes per IP)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const rateCheck = checkRateLimit(`signup:${ip}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
    }

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, password, and full name are required.' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const isAllowedDomain = trimmedEmail.endsWith('@zealeducation.com') || trimmedEmail.endsWith('@zcoer.edu.in');
    if (!isAllowedDomain) {
      return NextResponse.json({ 
        error: 'Only official college emails (@zealeducation.com or @zcoer.edu.in) are allowed to sign up.' 
      }, { status: 400 });
    }

    // Verify Firebase token if provided
    if (firebaseToken) {
      try {
        const { adminAuth } = await import('@/lib/firebase-admin');
        const decodedToken = await adminAuth.verifyIdToken(firebaseToken);
        if (decodedToken.email && decodedToken.email.toLowerCase() !== trimmedEmail) {
          return NextResponse.json({ error: 'Authentication email mismatch.' }, { status: 403 });
        }
      } catch (err: any) {
        console.warn('Firebase token verification notice:', err.message);
        // Do not reject if token expired during form fill, password will still be safely hashed
      }
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: trimmedEmail }
    });
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email is already registered. Please sign in.' }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    // Create user and teacher profile in a transaction with role TEACHER
    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: trimmedEmail,
          password_hash: hashed,
          full_name: full_name.trim(),
          role: 'TEACHER',
          status: 'ACTIVE',
        }
      });

      await tx.teacher.create({
        data: {
          id: u.id,
          department: department?.trim() || 'General',
          subject: subject?.trim() || 'Computer Science'
        }
      });

      return u;
    });

    // Ensure user exists in Firebase Admin for consistent auth sync
    try {
      const { adminAuth } = await import('@/lib/firebase-admin');
      try {
        await adminAuth.getUserByEmail(trimmedEmail);
      } catch (notFound) {
        await adminAuth.createUser({
          email: trimmedEmail,
          password,
          displayName: full_name.trim(),
          emailVerified: false,
        });
      }
    } catch (fbErr: any) {
      console.warn('Firebase sync note (DB user active):', fbErr?.message);
    }

    const authToken = await createAuthToken(newUser.id, newUser.role, newUser.email || '');

    return NextResponse.json({
      token: authToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
        department: department || 'General',
        subject: subject || 'Computer Science'
      }
    }, { status: 201 });

  } catch (err: any) {
    console.error('Signup Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
