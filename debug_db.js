const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  console.log("=== DB DEBUG INFO ===");
  
  const tests = await prisma.test.findMany({
    orderBy: { id: 'desc' },
    take: 3,
    include: { _count: { select: { testQuestions: true } } }
  });
  console.log("Latest Tests:", JSON.stringify(tests, null, 2));

  const sessions = await prisma.examSession.findMany({
    orderBy: { start_time: 'desc' },
    take: 5,
    include: {
      student: { select: { roll_number: true } },
      test: { select: { title: true } }
    }
  });
  console.log("\nLatest Sessions:", JSON.stringify(sessions, null, 2));

  console.log("=====================");
}

debug().catch(console.error).finally(() => prisma.$disconnect());
