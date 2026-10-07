import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const students = await prisma.student.findMany()
  const mockStudents = students.filter(s => !s.roll_number.startsWith('AD'))
  
  console.log(`Found ${mockStudents.length} mock students to delete.`)
  
  for (const s of mockStudents) {
    // Delete exam sessions for this student first to avoid foreign key constraint issues if any,
    // though Prisma might cascade it if set up.
    // Wait, let's just delete the user. Since User -> Student is cascade? 
    // Wait, Prisma schema says: Student -> User onDelete: Cascade. 
    // This means if I delete User, it should delete Student (actually it says Student has relation to User with onDelete: Cascade, so deleting User deletes Student? No, Prisma relation is on Student, meaning if User is deleted, Student is deleted).
    // Let's just delete Student, then User.
    
    // Actually, exam sessions are connected to Student. 
    await prisma.examSession.deleteMany({
      where: { student_id: s.id }
    })
    
    await prisma.student.delete({
      where: { id: s.id }
    })
    await prisma.user.delete({
      where: { id: s.id }
    })
  }
  
  console.log('Successfully deleted all mock students.')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
