import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding students...');

  // Create branch
  const aidsBranch = await prisma.branch.upsert({
    where: { code: 'AIDS' },
    update: {},
    create: {
      name: 'AI&DS',
      code: 'AIDS',
    }
  });

  // Create division
  const divA = await prisma.division.upsert({
    where: { name: 'A' },
    update: {},
    create: {
      name: 'A',
    }
  });

  const studentsToInsert = [];
  
  for (let i = 23101; i <= 23150; i++) {
    const rollNo = i.toString();
    
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: `${rollNo}@college.edu` }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `${rollNo}@college.edu`,
          password_hash: 'default_password',
          full_name: `Student ${rollNo}`,
          role: 'STUDENT',
          status: 'ACTIVE',
        }
      });
    }

    studentsToInsert.push({
      id: user.id, // Must match user_id
      roll_number: rollNo,
      branch_id: aidsBranch.id,
      division_id: divA.id,
    });
  }

  for (const studentData of studentsToInsert) {
    await prisma.student.upsert({
      where: { roll_number: studentData.roll_number },
      update: {},
      create: studentData
    });
  }

  console.log('Successfully seeded 50 students (23101 - 23150).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
