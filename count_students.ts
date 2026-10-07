import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const students = await prisma.student.findMany()
  console.log(`Total students: ${students.length}`)
}
main()
