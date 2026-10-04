import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminUser } from '@/lib/permissions';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can view teachers' }, { status: 403 });
  }

  const teachers = await prisma.teacher.findMany({
    include: {
      user: true,
      _count: { select: { tests: true, questions: true } }
    },
    orderBy: { created_at: 'asc' }
  });

  return NextResponse.json({
    teachers: teachers.map(t => ({
      id: t.id,
      email: t.user.email,
      full_name: t.user.full_name,
      status: t.user.status,
      department: t.department,
      subject: t.subject,
      test_count: t._count.tests,
      question_count: t._count.questions,
      created_at: t.created_at,
    }))
  });
}

export async function POST(request: NextRequest) {
  const payload = await getAdminUser(request);
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can manage teachers' }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === 'add') {
    const { email, full_name, password, department, subject } = body;
    if (!email || !full_name || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        full_name,
        role: 'TEACHER',
        status: 'ACTIVE',
        password_hash,
        teacher: {
          create: {
            department: department || null,
            subject: subject || null,
          }
        }
      }
    });

    return NextResponse.json({ success: true, id: user.id });
  }

  if (action === 'toggle_status') {
    const { id } = body;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await prisma.user.update({
      where: { id },
      data: { status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'reset_password') {
    const { id, new_password } = body;
    if (!new_password || new_password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    const password_hash = await bcrypt.hash(new_password, 10);
    await prisma.user.update({ where: { id }, data: { password_hash } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
