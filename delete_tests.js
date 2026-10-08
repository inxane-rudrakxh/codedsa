const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Deleting submission results...');
  await prisma.submissionResult.deleteMany();
  console.log('Deleting submissions...');
  await prisma.submission.deleteMany();
  console.log('Deleting code drafts...');
  await prisma.codeDraft.deleteMany();
  console.log('Deleting assigned questions...');
  await prisma.assignedQuestion.deleteMany();
  console.log('Deleting exam sessions...');
  await prisma.examSession.deleteMany();
  console.log('Deleting marks reports...');
  await prisma.marksReport.deleteMany();
  console.log('Deleting test questions...');
  await prisma.testQuestion.deleteMany();
  
  console.log('Deleting all tests...');
  const res = await prisma.test.deleteMany();
  console.log(`Deleted ${res.count} tests.`);

  console.log('Done');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
