import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyStudentSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentSessionToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { event_type } = body;

  if (!event_type) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  // Integrity / cheating monitoring is disabled
  return NextResponse.json({
    success: true,
    warnings: 0,
    max_warnings: 999999,
    exceeded: false,
  });
}
