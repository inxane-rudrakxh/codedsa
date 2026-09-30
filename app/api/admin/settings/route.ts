import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { data: settings } = await supabase.from('settings').select('*');
  const settingsMap: Record<string, string> = {};
  settings?.forEach(s => { settingsMap[s.key] = s.value; });

  return NextResponse.json({ settings: settingsMap });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { settings } = body;

  const entries = Object.entries(settings).map(([key, value]) => ({ key, value }));
  if (entries.length > 0) {
    await supabase.from('settings').upsert(entries);
  }

  return NextResponse.json({ success: true });
}
