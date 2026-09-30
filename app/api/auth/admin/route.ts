import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyPassword, createAdminToken, seedAdmin } from '@/lib/auth';

let seeded = false;
async function ensureSeeded() {
  if (!seeded) { await seedAdmin(); seeded = true; }
}

export async function POST(request: NextRequest) {
  await ensureSeeded();
  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const { data: admin } = await supabase.from('admins').select('*').eq('username', username).maybeSingle();

  if (!admin) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const token = await createAdminToken(admin.username);

  return NextResponse.json({ admin_token: token, username: admin.username });
}
