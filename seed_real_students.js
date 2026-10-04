const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const prisma = new PrismaClient();

async function seedStudents() {
  console.log("Cleaning up old dummy students...");
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({ where: { role: 'STUDENT' } });
  
  console.log("Reading real students...");
  const rawData = fs.readFileSync('real_students.txt', 'utf-8');
  const lines = rawData.split('\n').filter(l => l.trim().length > 0);
  
  const defaultPasswordHash = await bcrypt.hash('student123', 10);

  let branch = await prisma.branch.findUnique({ where: { code: 'AI&DS' } });
  if (!branch) {
    branch = await prisma.branch.create({ data: { code: 'AI&DS', name: 'AI&DS' } });
  }

  let divC = await prisma.division.findUnique({ where: { name: 'C' } });
  if (!divC) {
    divC = await prisma.division.create({ data: { name: 'C' } });
  }

  let divD = await prisma.division.findUnique({ where: { name: 'D' } });
  if (!divD) {
    divD = await prisma.division.create({ data: { name: 'D' } });
  }

  for (const line of lines) {
    const parts = line.split(' ');
    const roll = parts[0];
    const name = parts.slice(1).join(' ');
    
    // division C if AD13xx, D if AD14xx
    let division_id = roll.startsWith('AD13') ? divC.id : divD.id;

    console.log(`Inserting ${roll} - ${name}`);
    await prisma.user.create({
      data: {
        email: `${roll.toLowerCase()}@zcoer.edu.in`,
        full_name: name,
        role: 'STUDENT',
        status: 'ACTIVE',
        password_hash: defaultPasswordHash,
        student: {
          create: {
            roll_number: roll,
            branch_id: branch.id,
            division_id: division_id
          }
        }
      }
    });
  }

  console.log("Successfully inserted all real students!");
}

seedStudents()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
