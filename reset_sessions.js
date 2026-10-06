const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clear() {
  console.log("Clearing old test sessions...");
  await prisma.codeDraft.deleteMany({});
  await prisma.submissionResult.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.assignedQuestion.deleteMany({});
  await prisma.examSession.deleteMany({});
  console.log('Successfully cleared all old sessions! Students can now log into the new test.');
}

clear().catch(console.error).finally(() => prisma.$disconnect());
