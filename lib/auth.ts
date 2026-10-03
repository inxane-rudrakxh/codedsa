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

export async function createAuthToken(userId: string, role: string, email: string): Promise<string> {
  return new SignJWT({ user_id: userId, role, email, type: 'auth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifyAuthToken(token: string): Promise<{ user_id: string; role: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== 'auth') return null;
    return { user_id: payload.user_id as string, role: payload.role as string, email: payload.email as string };
  } catch {
    return null;
  }
}

// Exam sessions specifically for students
export async function createStudentSessionToken(userId: string, rollNo: string, sessionId: string): Promise<string> {
  return new SignJWT({ user_id: userId, roll_no: rollNo, session_id: sessionId, type: 'student_session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
}

export async function verifyStudentSessionToken(token: string): Promise<{ user_id: string; roll_no: string; session_id: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.type !== 'student_session' && payload.type !== 'student') return null; // Fallback for old tokens during migration
    return { user_id: (payload.user_id || '') as string, roll_no: payload.roll_no as string, session_id: payload.session_id as string };
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

