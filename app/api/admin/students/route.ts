import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  // Cannot order by cast in PostgREST easily, just order by roll_no string
  const { data: students } = await supabase.from('students').select('*').order('roll_no');
  return NextResponse.json({ students: students || [] });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { action, students, roll_no, name, division, branch } = body;

  if (action === 'import') {
    if (students && students.length > 0) {
      await supabase.from('students').upsert(
        students.map((s: any) => ({
          roll_no: s.roll_no,
          name: s.name,
          division: s.division,
          branch: s.branch || 'AI&DS'
        }))
      );
    }
    return NextResponse.json({ success: true, count: students?.length || 0 });
  }

  if (action === 'add') {
    await supabase.from('students').upsert({
      roll_no,
      name,
      division,
      branch: branch || 'AI&DS'
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'toggle') {
    const { data: current } = await supabase.from('students').select('is_active').eq('roll_no', roll_no).maybeSingle();
    if (!current) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    await supabase.from('students').update({ is_active: current.is_active ? 0 : 1 }).eq('roll_no', roll_no);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
