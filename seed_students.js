const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedStudents() {
  console.log("Generating students...");
  const defaultPasswordHash = await bcrypt.hash('student123', 10);

  // Ensure Branch and Divisions exist
  let branch = await prisma.branch.findUnique({ where: { code: 'AI&DS' } });
  if (!branch) {
    branch = await prisma.branch.create({ data: { code: 'AI&DS', name: 'AI&DS' } });
  }

  let divA = await prisma.division.findUnique({ where: { name: 'AIDS A' } });
  if (!divA) {
    divA = await prisma.division.create({ data: { name: 'AIDS A' } });
  }

  let divB = await prisma.division.findUnique({ where: { name: 'AIDS B' } });
  if (!divB) {
    divB = await prisma.division.create({ data: { name: 'AIDS B' } });
  }

  // Generate 20 dummy students for Division A
  for (let i = 1; i <= 20; i++) {
    const roll = `TIA10${i < 10 ? '0' + i : i}`;
    console.log(`Inserting ${roll}...`);
    await prisma.user.upsert({
      where: { email: `${roll.toLowerCase()}@zcoer.edu.in` },
      update: {},
      create: {
        email: `${roll.toLowerCase()}@zcoer.edu.in`,
        full_name: `Student ${roll}`,
        role: 'STUDENT',
        status: 'ACTIVE',
        password_hash: defaultPasswordHash,
        student: {
          create: {
            roll_number: roll,
            branch_id: branch.id,
            division_id: divA.id
          }
        }
      }
    });
  }

  // Generate 20 dummy students for Division B
  for (let i = 1; i <= 20; i++) {
    const roll = `TIB10${i < 10 ? '0' + i : i}`;
    console.log(`Inserting ${roll}...`);
    await prisma.user.upsert({
      where: { email: `${roll.toLowerCase()}@zcoer.edu.in` },
      update: {},
      create: {
        email: `${roll.toLowerCase()}@zcoer.edu.in`,
        full_name: `Student ${roll}`,
        role: 'STUDENT',
        status: 'ACTIVE',
        password_hash: defaultPasswordHash,
        student: {
          create: {
            roll_number: roll,
            branch_id: branch.id,
            division_id: divB.id
          }
        }
      }
    });
  }

  console.log("Successfully inserted 40 students!");
}

seedStudents()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
