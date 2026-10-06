const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding DSA Unit II Test...');

  // 1. Clean up old seeded tests & questions
  const oldTests = await prisma.test.findMany({ where: { status: 'PUBLISHED' }, orderBy: { created_at: 'asc' } });
  // Keep only if we want to re-seed fresh
  // We'll just create new ones and user can delete old via admin panel

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

  // 1.5 Get teacher (the admin account)
  const teacher = await prisma.teacher.findFirst();
  const teacher_id = teacher ? teacher.id : null;

  // 2. Create Test
  const test = await prisma.test.create({
    data: {
      title: 'Unit II – DSA 30 Marks Online Coding Test',
      description: 'The test consists of 30 marks. Any 3 random programs will appear on the screen. Each successful code execution carries 10 marks.',
      subject_id: subject.id,
      teacher_id: teacher_id,
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
      title: 'Array Operations – Insertion',
      slug: 'q1-array-insertion-' + Date.now(),
      topic: 'Arrays',
      description: 'Write a C/C++ program to insert an element at a specified position in an array.',
      input_format: 'You can use a hardcoded array or take input from the user.\nThe program should ask for: the array, the position to insert, and the element to insert.',
      output_format: 'Print the array after insertion.',
      constraints: '1 ≤ n ≤ 100\n1 ≤ position ≤ n+1\nElements can be any integers',
      testCases: [
        { input: '5\n1 2 3 4 5\n3\n99\n', expected_output: 'Array after insertion: 1 2 99 3 4 5', is_hidden: false }
      ]
    },
    {
      title: 'Array Operations – Deletion',
      slug: 'q2-array-deletion-' + Date.now(),
      topic: 'Arrays',
      description: 'Write a C/C++ program to delete an element from a specified position in an array.',
      input_format: 'You can use a hardcoded array or take input from the user.\nThe program should ask for: the array and the position to delete from.',
      output_format: 'Print the array after deletion.',
      constraints: '1 ≤ n ≤ 100\n1 ≤ position ≤ n\nElements can be any integers',
      testCases: [
        { input: '5\n1 2 3 4 5\n3\n', expected_output: 'Array after deletion: 1 2 4 5', is_hidden: false }
      ]
    },
    {
      title: 'Linear Search',
      slug: 'q3-linear-search-' + Date.now(),
      topic: 'Searching',
      description: 'Write a C/C++ program to search for a given element in an array using Linear Search algorithm.\n\nLinear Search checks each element one by one from the beginning until the target is found or the array ends.',
      input_format: 'You can use a hardcoded array or take input from the user.\nProvide the array and the element to search for.',
      output_format: 'Print whether the element was found and at what position (1-indexed), or "Element not found."',
      constraints: '1 ≤ n ≤ 100\nElements can be any integers',
      testCases: [
        { input: '5\n1 2 3 4 5\n3\n', expected_output: 'Element found at position 3', is_hidden: false },
      ]
    },
    {
      title: 'Binary Search',
      slug: 'q4-binary-search-' + Date.now(),
      topic: 'Searching',
      description: 'Write a C/C++ program to search for a given element in a sorted array using Binary Search.\n\nBinary Search repeatedly divides the search space in half by comparing the middle element with the target.',
      input_format: 'You can use a hardcoded sorted array or take input from the user.\nProvide the sorted array and the element to search.',
      output_format: 'Print whether the element was found and at what position (1-indexed), or "Element not found."',
      constraints: '1 ≤ n ≤ 100\nThe array must be sorted in ascending order',
      testCases: [
        { input: '5\n1 2 3 4 5\n4\n', expected_output: 'Element found at position 4', is_hidden: false },
      ]
    },
    {
      title: 'Bubble Sort',
      slug: 'q5-bubble-sort-' + Date.now(),
      topic: 'Sorting',
      description: 'Write a C/C++ program to sort an array in ascending order using the Bubble Sort algorithm.\n\nBubble Sort repeatedly swaps adjacent elements if they are in the wrong order, "bubbling" larger elements to the end.',
      input_format: 'You can use a hardcoded array or take input from the user.\nProvide the unsorted array.',
      output_format: 'Print the array after sorting in ascending order.',
      constraints: '1 ≤ n ≤ 100\nElements can be any integers',
      testCases: [
        { input: '5\n5 4 3 2 1\n', expected_output: 'Sorted array: 1 2 3 4 5', is_hidden: false }
      ]
    },
    {
      title: 'Insertion Sort',
      slug: 'q6-insertion-sort-' + Date.now(),
      topic: 'Sorting',
      description: 'Write a C/C++ program to sort an array in ascending order using the Insertion Sort algorithm.\n\nInsertion Sort builds the final sorted array one element at a time by picking each element and inserting it into its correct position.',
      input_format: 'You can use a hardcoded array or take input from the user.\nProvide the unsorted array.',
      output_format: 'Print the array after sorting in ascending order.',
      constraints: '1 ≤ n ≤ 100\nElements can be any integers',
      testCases: [
        { input: '5\n5 4 3 2 1\n', expected_output: 'Sorted array: 1 2 3 4 5', is_hidden: false }
      ]
    },
    {
      title: 'Selection Sort',
      slug: 'q7-selection-sort-' + Date.now(),
      topic: 'Sorting',
      description: 'Write a C/C++ program to sort an array in ascending order using the Selection Sort algorithm.\n\nSelection Sort finds the minimum element in the unsorted portion and places it at the beginning, repeating until sorted.',
      input_format: 'You can use a hardcoded array or take input from the user.\nProvide the unsorted array.',
      output_format: 'Print the array after sorting in ascending order.',
      constraints: '1 ≤ n ≤ 100\nElements can be any integers',
      testCases: [
        { input: '5\n5 4 3 2 1\n', expected_output: 'Sorted array: 1 2 3 4 5', is_hidden: false }
      ]
    },
    {
      title: 'Array Statistics',
      slug: 'q8-array-statistics-' + Date.now(),
      topic: 'Arrays',
      description: 'Write a C/C++ program to compute and display the sum, average, maximum, and minimum values of an array.',
      input_format: 'You can use a hardcoded array or take input from the user.\nProvide the array of numbers.',
      output_format: 'Print:\nSum = <value>\nAverage = <value>\nMaximum = <value>\nMinimum = <value>',
      constraints: '1 ≤ n ≤ 100\nElements can be any integers',
      testCases: [
        { input: '5\n1 2 3 4 5\n', expected_output: 'Sum = 15\nAverage = 3\nMaximum = 5\nMinimum = 1', is_hidden: false }
      ]
    },
    {
      title: 'Duplicate Elements',
      slug: 'q9-duplicate-elements-' + Date.now(),
      topic: 'Arrays',
      description: 'Write a C/C++ program to find and display all duplicate elements in an array.\n\nA duplicate element is one that appears more than once in the array.',
      input_format: 'You can use a hardcoded array or take input from the user.\nProvide the array of numbers.',
      output_format: 'Print the duplicate elements found, or print "No duplicate elements" if none exist.',
      constraints: '1 ≤ n ≤ 100\nElements can be any integers',
      testCases: [
        { input: '5\n1 2 3 2 1\n', expected_output: 'Duplicate elements: 1 2', is_hidden: false },
      ]
    }
  ];

  for (let i = 0; i < questionsData.length; i++) {
    const q = questionsData[i];

    const question = await prisma.question.create({
      data: {
        title: q.title,
        slug: q.slug,
        description: q.description,
        input_format: q.input_format,
        output_format: q.output_format,
        constraints: q.constraints,
        topic: q.topic,
        subject_id: subject.id,
        teacher_id: teacher_id,
        difficulty: 'MEDIUM',
        marks: 10,
        testCases: {
          create: q.testCases.map((tc, idx) => ({
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden,
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
  console.log('Test ID:', test.id);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
