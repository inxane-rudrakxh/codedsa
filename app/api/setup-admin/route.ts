import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@zcoer.edu.in' }
    });

    if (existingAdmin) {
      return NextResponse.json({ message: 'Admin already exists!' });
    }

    // Create the admin user
    await prisma.user.create({
      data: {
        email: 'admin@zcoer.edu.in',
        full_name: 'Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        password_hash: '$2a$10$e.wJ/k1.Gg.Q0nZ1v3zK4.eG4lK2W6J8M4y3A1p4Y4H7Q5S3X1V9G',
      }
    });

    return NextResponse.json({ message: 'Success! Admin user created successfully. You can now log in.' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create admin', details: error.message }, { status: 500 });
  }
}
