import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyStudentToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('exam_session')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyStudentToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Increment integrity warnings
  const { data, error } = await supabase.rpc('increment_warning', { s_id: payload.sessionId });

  if (error) {
    // Fallback if RPC doesn't exist
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('integrity_warnings')
      .eq('id', payload.sessionId)
      .single();
      
    if (session) {
      await supabase
        .from('exam_sessions')
        .update({ integrity_warnings: (session.integrity_warnings || 0) + 1 })
        .eq('id', payload.sessionId);
    }
  }

  return NextResponse.json({ success: true });
}
