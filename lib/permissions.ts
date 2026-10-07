import { verifyAuthToken } from './auth';
import { NextRequest } from 'next/server';

export async function getAdminUser(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyAuthToken(token);
  if (!payload) return null;
  if (payload.role !== 'ADMIN' && payload.role !== 'TEACHER') return null;
  return payload;
}

export function isAdmin(payload: { role: string } | null) {
  return payload?.role === 'ADMIN';
}

export function isTeacher(payload: { role: string } | null) {
  return payload?.role === 'TEACHER';
}

// Returns the teacher_id filter for scoped queries
// All accounts are isolated and only see their own tests
export function teacherScope(payload: { user_id: string; role: string } | null) {
  if (!payload) return null;
  return payload.user_id;
}
