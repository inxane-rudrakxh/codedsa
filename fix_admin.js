const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log("Generated hash:", hash);

  const user = await prisma.user.upsert({
    where: { email: 'admin@zcoer.edu.in' },
    update: {
      password_hash: hash,
      status: 'ACTIVE',
      role: 'ADMIN',
    },
    create: {
      email: 'admin@zcoer.edu.in',
      full_name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      password_hash: hash,
    },
  });

  console.log("Admin user ready:", user.email);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
