import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parseQuizText } from './lib/quizParser';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Quiz for /puzzle from quiz.txt...');

  // 1. Find or create Subject
  let subject = await prisma.subject.findFirst({
    where: { code: 'CG' }
  });
  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        code: 'CG',
        name: 'Computer Graphics',
      }
    });
    console.log('Created Subject: Computer Graphics');
  }

  // 2. Find Teacher / Admin
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'TEACHER'] } },
    orderBy: { created_at: 'asc' }
  });
  const teacher_id = adminUser ? adminUser.id : null;

  // 3. Read quiz.txt and parse
  const quizFilePath = path.join(process.cwd(), 'quiz.txt');
  const quizFileContent = fs.readFileSync(quizFilePath, 'utf8');
  const parsedQuestions = parseQuizText(quizFileContent);

  console.log(`Parsed ${parsedQuestions.length} questions from quiz.txt`);

  // Rich explanations for the 10 questions
  const explanations = [
    "A pixel (picture element) is the smallest controllable element of a picture represented on the screen.",
    "Bresenham's algorithm avoids expensive floating-point arithmetic by using incremental integer calculations.",
    "A monitor is the primary visual display output device in computer graphics.",
    "In DDA line algorithm, steps = max(|dx|, |dy|) = max(8, 5) = 8.",
    "Computer graphics is applied in CAD, animation, video games, visual effects, and simulations.",
    "Aspect ratio represents the proportional relationship between an image's width and its height.",
    "Mouse is an interactive pointing input device, whereas plotter, monitor, and projector are output devices.",
    "Scan conversion (rasterization) converts continuous geometric object descriptions into discrete pixels on screen.",
    "Circles possess 8-way symmetry, allowing calculations for only one 45° octant to determine all 8 octant points.",
    "A frame buffer is video memory that holds the color and intensity pixel data for the entire display screen."
  ];

  // 4. Create or update test with unique_id: 'puzzle'
  let test = await prisma.test.findUnique({
    where: { unique_id: 'puzzle' }
  });

  if (!test) {
    test = await prisma.test.create({
      data: {
        unique_id: 'puzzle',
        title: 'Computer Graphics & Visual Systems Quiz',
        description: 'Objective assessment covering raster graphics, scan conversion algorithms, frame buffers, and display systems.',
        instructions: 'Please answer all 10 questions. This test is fully optimized for mobile and desktop screens. Each question carries 1 mark.',
        subject_id: subject.id,
        teacher_id: teacher_id,
        duration_minutes: 30,
        total_marks: parsedQuestions.length || 10,
        test_type: 'QUIZ',
        auto_approve: false,
        marks_published: true,
        randomize_questions: false,
        questions_per_student: parsedQuestions.length || 10,
        status: 'PUBLISHED',
      }
    });
    console.log('Created test with slug: puzzle');
  } else {
    test = await prisma.test.update({
      where: { id: test.id },
      data: {
        title: 'Computer Graphics & Visual Systems Quiz',
        subject_id: subject.id,
        teacher_id: teacher_id,
        test_type: 'QUIZ',
        auto_approve: false,
        marks_published: true,
        duration_minutes: 30,
        total_marks: parsedQuestions.length || 10,
        questions_per_student: parsedQuestions.length || 10,
        status: 'PUBLISHED',
      }
    });
    console.log('Updated existing test: puzzle');
  }

  // 5. Clean up existing questions for this test and insert fresh
  await prisma.quizAnswer.deleteMany({ where: { question: { test_id: test.id } } });
  await prisma.quizQuestion.deleteMany({ where: { test_id: test.id } });

  for (let i = 0; i < parsedQuestions.length; i++) {
    const q = parsedQuestions[i];
    await prisma.quizQuestion.create({
      data: {
        test_id: test.id,
        type: q.type,
        question_text: q.question_text,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: explanations[i] || q.explanation || null,
        marks: q.marks || 1,
        order_index: i + 1,
      }
    });
  }

  console.log(`Successfully added ${parsedQuestions.length} questions to /puzzle test!`);
}

main()
  .catch(e => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
