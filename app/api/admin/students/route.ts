import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  if (payload.role !== 'ADMIN' && payload.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });

  const studentsData = await prisma.student.findMany({
    include: {
      user: true,
      branch: true,
      division: true
    },
    orderBy: { roll_number: 'asc' }
  });

  const formatted = studentsData.map(s => ({
    roll_no: s.roll_number,
    name: s.user.full_name,
    branch: s.branch.name,
    division: (s.division?.name === 'A' || s.division?.name === 'AIDS A') ? 'AIDS A' : (s.division?.name === 'B' || s.division?.name === 'AIDS B') ? 'AIDS B' : (s.division?.name || 'AIDS A'),
    is_active: s.user.status === 'ACTIVE' ? 1 : 0
  }));

  return NextResponse.json({ students: formatted });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyAuthToken(token);
  if (payload && payload.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized role' }, { status: 403 });
  if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const body = await request.json();
  const { action, students, roll_no, name, division, branch } = body;

  const ensureBranchDiv = async (branchCode: string, divName: string) => {
    let b = await prisma.branch.findUnique({ where: { code: branchCode } });
    if (!b) b = await prisma.branch.create({ data: { code: branchCode, name: branchCode } });
    
    let d = await prisma.division.findUnique({ where: { name: divName } });
    if (!d) d = await prisma.division.create({ data: { name: divName } });
    return { branch_id: b.id, division_id: d.id };
  };

  if (action === 'import') {
    if (students && students.length > 0) {
      for (const s of students) {
        const { branch_id, division_id } = await ensureBranchDiv(s.branch || 'AI&DS', s.division || 'A');
        const roll = s.roll_no.toUpperCase();
        
        await prisma.user.upsert({
          where: { email: `${roll.toLowerCase()}@zcoer.edu.in` },
          update: { full_name: s.name },
          create: {
            email: `${roll.toLowerCase()}@zcoer.edu.in`,
            full_name: s.name,
            role: 'STUDENT',
            status: 'ACTIVE',
            student: {
              create: {
                roll_number: roll,
                branch_id,
                division_id
              }
            }
          }
        });
      }
    }
    return NextResponse.json({ success: true, count: students?.length || 0 });
  }

  if (action === 'add') {
    const { branch_id, division_id } = await ensureBranchDiv(branch || 'AI&DS', division || 'A');
    const roll = roll_no.toUpperCase();
    await prisma.user.upsert({
      where: { email: `${roll.toLowerCase()}@zcoer.edu.in` },
      update: { full_name: name },
      create: {
        email: `${roll.toLowerCase()}@zcoer.edu.in`,
        full_name: name,
        role: 'STUDENT',
        status: 'ACTIVE',
        student: {
          create: { roll_number: roll, branch_id, division_id }
        }
      }
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'toggle') {
    const studentData = await prisma.student.findUnique({
      where: { roll_number: roll_no.toUpperCase() },
      include: { user: true }
    });
    if (!studentData) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    
    await prisma.user.update({
      where: { id: studentData.id },
      data: { status: studentData.user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
