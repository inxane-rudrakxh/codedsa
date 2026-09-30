import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'codedsa-secret-key-change-in-production-2024'
);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createStudentToken(roll_no: string, session_id: string): Promise<string> {
  return new SignJWT({ roll_no, session_id, type: 'student' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
}

export async function createAdminToken(username: string): Promise<string> {
  return new SignJWT({ username, type: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifyStudentToken(token: string): Promise<{ roll_no: string; session_id: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== 'student') return null;
    return { roll_no: payload.roll_no as string, session_id: payload.session_id as string };
  } catch {
    return null;
  }
}

export async function verifyAdminToken(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== 'admin') return null;
    return { username: payload.username as string };
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSubmissionId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Seed default admin if none exists
export async function seedAdmin(): Promise<void> {
  const { supabase } = await import('./supabase');
  const { data: existing } = await supabase.from('admins').select('id').limit(1).maybeSingle();
  if (!existing) {
    const hash = await hashPassword('kiran123');
    await supabase.from('admins').insert({ username: 'kirank', password_hash: hash });
    console.log('Default admin created: kirank / kiran123');
  }
}
