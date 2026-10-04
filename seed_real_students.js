const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedStudents() {
  console.log("Reading real_students.txt...");
  const content = fs.readFileSync('real_students.txt', 'utf8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  const defaultPasswordHash = await bcrypt.hash('student123', 10);

  // Ensure Branch exists
  let branch = await prisma.branch.findUnique({ where: { code: 'AI&DS' } });
  if (!branch) {
    branch = await prisma.branch.create({ data: { code: 'AI&DS', name: 'AI&DS' } });
  }

  // Ensure Divisions C and D exist
  let divC = await prisma.division.findUnique({ where: { name: 'C' } });
  if (!divC) {
    divC = await prisma.division.create({ data: { name: 'C' } });
  }

  let divD = await prisma.division.findUnique({ where: { name: 'D' } });
  if (!divD) {
    divD = await prisma.division.create({ data: { name: 'D' } });
  }

  console.log("Processing students...");
  let count = 0;
  for (const line of lines) {
    const parts = line.trim().split(' ');
    const roll = parts[0];
    const name = parts.slice(1).join(' ');
    
    if (!roll.startsWith('AD')) continue;

    const divId = roll.startsWith('AD13') ? divC.id : (roll.startsWith('AD14') ? divD.id : null);
    if (!divId) {
      console.log(`Skipping unknown roll series: ${roll}`);
      continue;
    }

    await prisma.user.upsert({
      where: { email: `${roll.toLowerCase()}@zcoer.edu.in` },
      update: {
        full_name: name,
        student: {
            update: {
                branch_id: branch.id,
                division_id: divId
            }
        }
      },
      create: {
        email: `${roll.toLowerCase()}@zcoer.edu.in`,
        full_name: name,
        role: 'STUDENT',
        status: 'ACTIVE',
        password_hash: defaultPasswordHash,
        student: {
          create: {
            roll_number: roll,
            branch_id: branch.id,
            division_id: divId
          }
        }
      }
    });
    console.log(`Inserted ${roll}: ${name}`);
    count++;
  }

  console.log(`Successfully processed ${count} students!`);
}

seedStudents()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
