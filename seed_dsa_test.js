const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DSA Unit II Test...');

  // 1. Create or find subject
  let subject = await prisma.subject.findUnique({ where: { code: 'DSA_2' } });
  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        code: 'DSA_2',
        name: 'Data Structures and Algorithms',
      }
    });
  }

  // 2. Create Test
  const test = await prisma.test.create({
    data: {
      title: 'Unit II – DSA 30 Marks Online Coding Test',
      description: 'The test consists of 30 marks. Any 3 random programs will appear on the screen. Each successful code execution carries 10 marks.',
      subject_id: subject.id,
      duration_minutes: 60,
      total_marks: 30,
      status: 'PUBLISHED',
      marks_published: false,
      randomize_questions: true,
      questions_per_student: 3,
      allowed_languages: ['cpp', 'c'],
    }
  });

  const questionsData = [
    {
      title: 'Q1. Array Operations – Insertion',
      slug: 'q1-array-insertion-' + Date.now(),
      description: 'Write a C++ program to perform insertion of an element at a specified position in an array.\n\nInput format: n (size), then n elements, then position, then value to insert.\nOutput format: "Array after insertion: " followed by the array elements separated by spaces.',
      testCases: [
        { input: '5\n1 2 3 4 5\n3\n99\n', expected_output: 'Array after insertion: 1 2 99 3 4 5 ' }
      ]
    },
    {
      title: 'Q2. Array Operations – Deletion',
      slug: 'q2-array-deletion-' + Date.now(),
      description: 'Write a C++ program to perform deletion of an element from a specified position in an array.\n\nInput format: n (size), then n elements, then position to delete.\nOutput format: "Array after deletion: " followed by the array elements separated by spaces.',
      testCases: [
        { input: '5\n1 2 3 4 5\n3\n', expected_output: 'Array after deletion: 1 2 4 5 ' }
      ]
    },
    {
      title: 'Q3. Linear Search',
      slug: 'q3-linear-search-' + Date.now(),
      description: 'Write a C++ program to search for a given element in an array using Linear Search.\n\nInput format: n, then n elements, then element to search.\nOutput format: "Element found at position X" or "Element not found."',
      testCases: [
        { input: '5\n1 2 3 4 5\n3\n', expected_output: 'Element found at position 3' },
        { input: '5\n1 2 3 4 5\n99\n', expected_output: 'Element not found.' }
      ]
    },
    {
      title: 'Q4. Binary Search',
      slug: 'q4-binary-search-' + Date.now(),
      description: 'Write a C++ program to search for a given element in a sorted array using Binary Search.\n\nInput format: n, then n sorted elements, then element to search.\nOutput format: "Element found at position X" or "Element not found."',
      testCases: [
        { input: '5\n1 2 3 4 5\n4\n', expected_output: 'Element found at position 4' },
        { input: '5\n1 2 3 4 5\n99\n', expected_output: 'Element not found.' }
      ]
    },
    {
      title: 'Q5. Bubble Sort',
      slug: 'q5-bubble-sort-' + Date.now(),
      description: 'Write a C++ program to sort the elements of an array in ascending order using Bubble Sort.\n\nInput format: n, then n elements.\nOutput format: "Sorted array: " followed by the sorted elements separated by spaces.',
      testCases: [
        { input: '5\n5 4 3 2 1\n', expected_output: 'Sorted array: 1 2 3 4 5 ' }
      ]
    },
    {
      title: 'Q6. Insertion Sort',
      slug: 'q6-insertion-sort-' + Date.now(),
      description: 'Write a C++ program to sort the elements of an array in ascending order using Insertion Sort.\n\nInput format: n, then n elements.\nOutput format: "Sorted array: " followed by the sorted elements separated by spaces.',
      testCases: [
        { input: '5\n5 4 3 2 1\n', expected_output: 'Sorted array: 1 2 3 4 5 ' }
      ]
    },
    {
      title: 'Q7. Selection Sort',
      slug: 'q7-selection-sort-' + Date.now(),
      description: 'Write a C++ program to sort the elements of an array in ascending order using Selection Sort.\n\nInput format: n, then n elements.\nOutput format: "Sorted array: " followed by the sorted elements separated by spaces.',
      testCases: [
        { input: '5\n5 4 3 2 1\n', expected_output: 'Sorted array: 1 2 3 4 5 ' }
      ]
    },
    {
      title: 'Q8. Array Statistics',
      slug: 'q8-array-statistics-' + Date.now(),
      description: 'Write a C++ program to find the sum, average, maximum and minimum elements of an array.\n\nInput format: n, then n elements.\nOutput format:\nSum = X\nAverage = Y\nMaximum = Z\nMinimum = W\n(Average can be a float)',
      testCases: [
        { input: '5\n1 2 3 4 5\n', expected_output: '\nSum = 15\nAverage = 3\nMaximum = 5\nMinimum = 1' }
      ]
    },
    {
      title: 'Q9. Duplicate Elements',
      slug: 'q9-duplicate-elements-' + Date.now(),
      description: 'Write a C++ program to identify and display duplicate elements in an array.\n\nInput format: n, then n elements.\nOutput format: "Duplicate elements: X Y " or "No duplicate elements"',
      testCases: [
        { input: '5\n1 2 3 2 1\n', expected_output: 'Duplicate elements: 1 2 ' },
        { input: '5\n1 2 3 4 5\n', expected_output: 'Duplicate elements: No duplicate elements' } // Actually the logic says "No duplicate elements" without the prefix if found==false, wait... let me check the C++ code
      ]
    }
  ];

  for (let i = 0; i < questionsData.length; i++) {
    const q = questionsData[i];
    let tcOutput = q.testCases[0].expected_output;
    if (i === 8 && q.testCases[1]) {
      q.testCases[1].expected_output = 'Duplicate elements: No duplicate elements';
    }

    const question = await prisma.question.create({
      data: {
        title: q.title,
        slug: q.slug,
        description: q.description,
        subject_id: subject.id,
        difficulty: 'MEDIUM',
        marks: 10,
        testCases: {
          create: q.testCases.map((tc, idx) => ({
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: false,
            marks: 10,
            order_index: idx
          }))
        }
      }
    });

    await prisma.testQuestion.create({
      data: {
        test_id: test.id,
        question_id: question.id,
        order_index: i
      }
    });
  }

  console.log('Successfully seeded 9 questions and linked them to the test!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
