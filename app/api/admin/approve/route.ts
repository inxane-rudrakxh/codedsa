import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAdminToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { session_id, action } = body;

  if (!session_id || !action) {
    return NextResponse.json({ error: 'Missing session_id or action' }, { status: 400 });
  }

  if (action === 'approve') {
    // Approve the session: update status and reset start_time to NOW
    const { error } = await supabase
      .from('exam_sessions')
      .update({
        status: 'active',
        start_time: new Date().toISOString()
      })
      .eq('id', session_id)
      .eq('status', 'pending_approval');
      
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'reject') {
    // Delete the session entirely so they can try again
    const { error } = await supabase
      .from('exam_sessions')
      .delete()
      .eq('id', session_id)
      .eq('status', 'pending_approval');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
