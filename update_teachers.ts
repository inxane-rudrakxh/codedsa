import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const result = await prisma.user.updateMany({
    where: { role: 'TEACHER' },
    data: { role: 'ADMIN' }
  })
  console.log(`Updated ${result.count} users from TEACHER to ADMIN.`)
}
main()
