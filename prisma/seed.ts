import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding data...')
  
  // 1. Admin User
  const adminPasswordHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@zcoer.edu.in' },
    update: {},
    create: {
      id: 'admin-1',
      email: 'admin@zcoer.edu.in',
      full_name: 'ZCOER Admin',
      role: 'ADMIN',
      password_hash: adminPasswordHash,
      status: 'ACTIVE'
    }
  })
  
  // 2. Branches
  const aids = await prisma.branch.upsert({
    where: { code: 'AI&DS' },
    update: {},
    create: { code: 'AI&DS', name: 'Artificial Intelligence and Data Science' }
  })
  const comp = await prisma.branch.upsert({
    where: { code: 'COMP' },
    update: {},
    create: { code: 'COMP', name: 'Computer Engineering' }
  })
  const it = await prisma.branch.upsert({
    where: { code: 'IT' },
    update: {},
    create: { code: 'IT', name: 'Information Technology' }
  })
  
  // 3. Divisions
  const divD = await prisma.division.upsert({
    where: { name: 'D' },
    update: {},
    create: { name: 'D' }
  })
  const divE = await prisma.division.upsert({
    where: { name: 'E' },
    update: {},
    create: { name: 'E' }
  })
  const divA = await prisma.division.upsert({
    where: { name: 'A' },
    update: {},
    create: { name: 'A' }
  })

  // 4. Sample Students
  const students = [
    { roll: 'AD1401', name: 'KAMBLE SAMITI SACHIN', branch: aids.id, div: divD.id },
    { roll: 'AD1402', name: 'NEMANE KARTIK HARIDAS', branch: aids.id, div: divD.id },
    { roll: 'CO1401', name: 'RUDRAKSH KHATRI', branch: comp.id, div: divA.id },
    { roll: 'IT1401', name: 'JOHN DOE', branch: it.id, div: divE.id },
  ]
  
  for (const s of students) {
    const user = await prisma.user.upsert({
      where: { email: `${s.roll.toLowerCase()}@zcoer.edu.in` },
      update: {},
      create: {
        id: `student-${s.roll}`,
        email: `${s.roll.toLowerCase()}@zcoer.edu.in`,
        full_name: s.name,
        role: 'STUDENT',
        status: 'ACTIVE',
        student: {
          create: {
            roll_number: s.roll,
            branch_id: s.branch,
            division_id: s.div
          }
        }
      }
    })
  }

  // 5. Teacher
  const teacherPasswordHash = await bcrypt.hash('teacher123', 10)
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@zcoer.edu.in' },
    update: {},
    create: {
      id: 'teacher-1',
      email: 'teacher@zcoer.edu.in',
      full_name: 'Jane Doe',
      role: 'TEACHER',
      password_hash: teacherPasswordHash,
      status: 'ACTIVE',
      teacher: {
        create: {
          department: 'AI&DS'
        }
      }
    }
  })

  // 6. Subjects & Tests
  const dsa = await prisma.subject.upsert({
    where: { code: 'DSA' },
    update: {},
    create: { code: 'DSA', name: 'Data Structures and Algorithms' }
  })

  const test = await prisma.test.create({
    data: {
      unique_id: 'SEED-TEST-ID',
      title: 'Unit II – DSA 30 Marks Online Coding Test',
      description: 'ZCOER coding test for Unit II DSA',
      subject_id: dsa.id,
      duration_minutes: 60,
      total_marks: 30,
      status: 'PUBLISHED',
      randomize_questions: true,
      questions_per_student: 3
    }
  })
  
  console.log('Seeding complete!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
