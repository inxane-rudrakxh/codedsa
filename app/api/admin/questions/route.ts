import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { data: questions } = await supabase.from('questions').select('*, test_cases(*)').order('id');
  
  // Sort test cases if needed (they should already be part of the relationship)
  const formatted = questions?.map(q => ({
    ...q,
    test_cases: q.test_cases.sort((a: any, b: any) => a.id - b.id)
  })) || [];

  return NextResponse.json({ questions: formatted });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAdminToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  if (action === 'toggle') {
    const { data: q } = await supabase.from('questions').select('is_enabled').eq('id', body.id).maybeSingle();
    if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    await supabase.from('questions').update({ is_enabled: q.is_enabled ? 0 : 1 }).eq('id', body.id);
    return NextResponse.json({ success: true });
  }

  if (action === 'update') {
    const { id, title, topic, statement, input_format, output_format, constraints, example_input, example_output } = body;
    await supabase.from('questions').update({
      title, topic, statement, input_format, output_format, constraints, example_input, example_output
    }).eq('id', id);
    return NextResponse.json({ success: true });
  }

  if (action === 'add_test_case') {
    const { question_id, input, expected_output, type, is_visible, weight } = body;
    await supabase.from('test_cases').insert({
      question_id, input, expected_output, type: type || 'hidden', is_visible: is_visible ? 1 : 0, weight: weight || 1
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_test_case') {
    await supabase.from('test_cases').delete().eq('id', body.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
