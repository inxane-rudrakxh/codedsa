import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (payload && payload.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const settings = await prisma.setting.findMany();
  const settingsMap: Record<string, string> = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });

  return NextResponse.json({ settings: settingsMap });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (payload && payload.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { settings } = body;

  const entries = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
  if (entries.length > 0) {
    for (const e of entries) {
      await prisma.setting.upsert({
        where: { key: e.key },
        update: { value: e.value },
        create: { key: e.key, value: e.value }
      });
    }
  }

  return NextResponse.json({ success: true });
}
