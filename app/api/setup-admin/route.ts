import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key') || request.headers.get('x-setup-key');
    const expectedKey = process.env.SETUP_ADMIN_KEY;

    if (process.env.NODE_ENV === 'production' && (!expectedKey || key !== expectedKey)) {
      return NextResponse.json({ error: 'Unauthorized: Valid setup key required.' }, { status: 403 });
    }

    // Check if an admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (existingAdmin) {
      return NextResponse.json({ message: 'Admin account already initialized.' }, { status: 400 });
    }

    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@Zcoer2024';
    const hashedPassword = await hashPassword(initialPassword);

    // Create the initial superadmin user
    await prisma.user.create({
      data: {
        email: 'admin@zcoer.edu.in',
        full_name: 'System Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        password_hash: hashedPassword,
      }
    });

    return NextResponse.json({ message: 'Success! Initial admin user created successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create admin', details: error.message }, { status: 500 });
  }
}
