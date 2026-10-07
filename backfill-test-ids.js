const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function main() {
  const tests = await prisma.test.findMany();

  console.log(`Found ${tests.length} tests`);

  for (const test of tests) {
    if (!test.unique_id) {
        const uniqueId = `DSA-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
        try {
          await prisma.test.update({
            where: { id: test.id },
            data: { unique_id: uniqueId }
          });
          console.log(`Updated test ${test.id} with unique_id ${uniqueId}`);
        } catch (e) {
          console.error(e);
        }
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
