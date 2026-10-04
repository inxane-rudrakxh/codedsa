import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, createAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, department, subject } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, password, and name are required.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email is already in use.' }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    // Create user and teacher profile in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          password_hash: hashed,
          full_name,
          role: 'TEACHER',
          status: 'ACTIVE',
        }
      });

      await tx.teacher.create({
        data: {
          id: u.id,
          department: department || 'General',
          subject: subject || 'Computer Science'
        }
      });

      return u;
    });

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
