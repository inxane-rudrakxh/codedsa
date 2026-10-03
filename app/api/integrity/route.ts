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

  // Increment warning count
  const sessionData = await prisma.examSession.findUnique({ where: { id: payload.session_id } });
  const currentWarnings = sessionData?.integrity_warnings || 0;
  const newWarnings = currentWarnings + 1;

  await prisma.examSession.update({
    where: { id: payload.session_id },
    data: { integrity_warnings: newWarnings }
  });

  // Get max warnings
  const maxWarnSetting = await prisma.setting.findUnique({ where: { key: 'max_integrity_warnings' } });
  const maxWarnings = parseInt(maxWarnSetting?.value || '3', 10);

  return NextResponse.json({
    success: true,
    warnings: newWarnings,
    max_warnings: maxWarnings,
    exceeded: newWarnings >= maxWarnings,
  });
}
