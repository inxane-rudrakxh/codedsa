import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyStudentToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyStudentToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { event_type } = body;

  if (!event_type) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  // Record event
  await supabase.from('integrity_events').insert({
    session_id: payload.session_id,
    event_type,
    timestamp: new Date().toISOString()
  });

  // Increment warning count (Read then write since Supabase doesn't support atomic increment easily without RPC)
  const { data: sessionData } = await supabase.from('exam_sessions').select('integrity_warnings').eq('id', payload.session_id).maybeSingle();
  const currentWarnings = sessionData?.integrity_warnings || 0;
  const newWarnings = currentWarnings + 1;

  await supabase.from('exam_sessions').update({ integrity_warnings: newWarnings }).eq('id', payload.session_id);

  // Get max warnings
  const { data: maxWarnSetting } = await supabase.from('settings').select('value').eq('key', 'max_integrity_warnings').maybeSingle();
  const maxWarnings = parseInt(maxWarnSetting?.value || '3', 10);

  return NextResponse.json({
    success: true,
    warnings: newWarnings,
    max_warnings: maxWarnings,
    exceeded: newWarnings >= maxWarnings,
  });
}
