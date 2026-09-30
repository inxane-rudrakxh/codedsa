import getDb from './db';
import { hashPassword } from './auth';

export async function seed() {
  const db = getDb();

  // Seed students
  const students = [
    { roll_no: '01', name: 'AANYA SHARMA', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '02', name: 'ARJUN PATIL', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '03', name: 'BHAVESH KULKARNI', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '04', name: 'CHETAN DESAI', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '05', name: 'DEEPIKA NAIR', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '06', name: 'ESHAN MEHTA', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '07', name: 'FALGUNI JOSHI', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '08', name: 'GAURAV SINGH', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '09', name: 'HARSHA REDDY', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '10', name: 'ISHAAN BHAT', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '11', name: 'JAYESH PAWAR', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '12', name: 'KAVYA IYER', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '13', name: 'LOKESH KUMAR', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '14', name: 'MEERA PILLAI', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '15', name: 'NIKHIL SAWANT', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '16', name: 'OMKAR GORE', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '17', name: 'PRIYA THAKUR', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '18', name: 'RAHUL KAMBLE', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '19', name: 'SNEHA PANDEY', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '20', name: 'TANMAY SHAH', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '21', name: 'RUDRAKSH', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '22', name: 'UTKARSH MORE', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '23', name: 'VIDHI JAIN', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '24', name: 'WARDA KHAN', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '25', name: 'XAVIER PINTO', division: 'AIDS A', branch: 'AI&DS' },
    { roll_no: '26', name: 'YASH GAIKWAD', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '27', name: 'ZAR ANSARI', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '28', name: 'AKASH TIWARI', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '29', name: 'BHAKTI SHINDE', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '30', name: 'CHINMAY DESHPANDE', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '31', name: 'DIKSHA MISHRA', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '32', name: 'EKTA GUPTA', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '33', name: 'FARHAN SHAIKH', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '34', name: 'GAURANGI PATEL', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '35', name: 'HARSH VERMA', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '36', name: 'ISHA RANE', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '37', name: 'JATIN DHAWAN', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '38', name: 'KEDAR MOHITE', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '39', name: 'LATA SHETTY', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '40', name: 'MANDAR KULKARNI', division: 'AIDS B', branch: 'AI&DS' },
    { roll_no: '72', name: 'ANANYA GOKHALE', division: 'AIDS B', branch: 'AI&DS' },
  ];

  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students (roll_no, name, division, branch) VALUES (?, ?, ?, ?)
  `);

  for (const s of students) {
    insertStudent.run(s.roll_no, s.name, s.division, s.branch);
  }

  // Seed admin
  const existingAdmin = db.prepare('SELECT id FROM admins LIMIT 1').get();
  if (!existingAdmin) {
    const hash = await hashPassword('kiran123');
    db.prepare('INSERT OR IGNORE INTO admins (username, password_hash) VALUES (?, ?)').run('kirank', hash);
  }

  // Seed questions
  const questions = [
    {
      title: 'Array Insertion',
      topic: 'Array Operations',
      statement: 'Write a C++ program to perform insertion of an element at a specified position in an array.\n\nYou are given an array of N integers. Insert a given element X at position P (1-indexed). All elements from position P onward should shift right. The array size increases by 1.',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers\nLine 3: Integer X (element to insert)\nLine 4: Integer P (position to insert at, 1-indexed)',
      output_format: 'Print the modified array with N+1 elements, space-separated on a single line.',
      constraints: '1 ≤ N ≤ 100\n-1000 ≤ array elements ≤ 1000\n1 ≤ P ≤ N+1',
      example_input: '5\n1 2 3 4 5\n10\n3',
      example_output: '1 2 10 3 4 5',
    },
    {
      title: 'Array Deletion',
      topic: 'Array Operations',
      statement: 'Write a C++ program to perform deletion of an element from a specified position in an array.\n\nYou are given an array of N integers. Delete the element at position P (1-indexed). All elements after position P should shift left. The array size decreases by 1.',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers\nLine 3: Integer P (position to delete from, 1-indexed)',
      output_format: 'Print the modified array with N-1 elements, space-separated on a single line.',
      constraints: '2 ≤ N ≤ 100\n-1000 ≤ array elements ≤ 1000\n1 ≤ P ≤ N',
      example_input: '5\n1 2 3 4 5\n3',
      example_output: '1 2 4 5',
    },
    {
      title: 'Linear Search',
      topic: 'Searching',
      statement: 'Write a C++ program to search for a given element in an array using Linear Search.\n\nYou are given an array of N integers. Search for element X. If found, print the 1-indexed position of its first occurrence. If not found, print -1.',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers\nLine 3: Integer X (element to search)',
      output_format: 'Print the 1-indexed position of the first occurrence of X, or -1 if not found.',
      constraints: '1 ≤ N ≤ 100\n-1000 ≤ array elements ≤ 1000',
      example_input: '5\n10 20 30 40 50\n30',
      example_output: '3',
    },
    {
      title: 'Binary Search',
      topic: 'Searching',
      statement: 'Write a C++ program to search for a given element in a sorted array using Binary Search.\n\nYou are given a sorted array of N integers (in ascending order). Search for element X using the Binary Search algorithm. Print the 1-indexed position if found, or -1 if not found.',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers (sorted in ascending order)\nLine 3: Integer X (element to search)',
      output_format: 'Print the 1-indexed position of X, or -1 if not found.',
      constraints: '1 ≤ N ≤ 1000\n-10000 ≤ array elements ≤ 10000\nArray is sorted in ascending order',
      example_input: '6\n2 5 8 12 16 23\n12',
      example_output: '4',
    },
    {
      title: 'Bubble Sort',
      topic: 'Sorting',
      statement: 'Write a C++ program to sort the elements of an array in ascending order using Bubble Sort.\n\nYou are given an array of N integers. Sort the array in ascending order using the Bubble Sort algorithm and print the sorted array.',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers',
      output_format: 'Print the sorted array elements space-separated on a single line.',
      constraints: '1 ≤ N ≤ 100\n-1000 ≤ array elements ≤ 1000',
      example_input: '5\n64 34 25 12 22',
      example_output: '12 22 25 34 64',
    },
    {
      title: 'Insertion Sort',
      topic: 'Sorting',
      statement: 'Write a C++ program to sort the elements of an array in ascending order using Insertion Sort.\n\nYou are given an array of N integers. Sort the array in ascending order using the Insertion Sort algorithm and print the sorted array.',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers',
      output_format: 'Print the sorted array elements space-separated on a single line.',
      constraints: '1 ≤ N ≤ 100\n-1000 ≤ array elements ≤ 1000',
      example_input: '5\n12 11 13 5 6',
      example_output: '5 6 11 12 13',
    },
    {
      title: 'Selection Sort',
      topic: 'Sorting',
      statement: 'Write a C++ program to sort the elements of an array in ascending order using Selection Sort.\n\nYou are given an array of N integers. Sort the array in ascending order using the Selection Sort algorithm and print the sorted array.',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers',
      output_format: 'Print the sorted array elements space-separated on a single line.',
      constraints: '1 ≤ N ≤ 100\n-1000 ≤ array elements ≤ 1000',
      example_input: '5\n64 25 12 22 11',
      example_output: '11 12 22 25 64',
    },
    {
      title: 'Array Statistics',
      topic: 'Array Analysis',
      statement: 'Write a C++ program to find the sum, average, maximum and minimum elements of an array.\n\nYou are given an array of N integers. Compute and print its sum, average (as a float with 2 decimal places), maximum element, and minimum element.',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers',
      output_format: 'Four lines:\nLine 1: Sum\nLine 2: Average (2 decimal places)\nLine 3: Maximum\nLine 4: Minimum',
      constraints: '1 ≤ N ≤ 100\n-10000 ≤ array elements ≤ 10000',
      example_input: '5\n3 1 4 1 5',
      example_output: '14\n2.80\n5\n1',
    },
    {
      title: 'Duplicate Elements',
      topic: 'Array Analysis',
      statement: 'Write a C++ program to identify and display duplicate elements in an array.\n\nYou are given an array of N integers. Find and print all elements that appear more than once. Each duplicate should be printed only once, in the order of their first occurrence. If no duplicates exist, print "No duplicates found".',
      input_format: 'Line 1: Integer N (size of array)\nLine 2: N space-separated integers',
      output_format: 'Print duplicate elements space-separated on a single line, or "No duplicates found" if none exist.',
      constraints: '1 ≤ N ≤ 100\n-1000 ≤ array elements ≤ 1000',
      example_input: '7\n1 2 3 2 4 3 5',
      example_output: '2 3',
    },
  ];

  const insertQuestion = db.prepare(`
    INSERT OR IGNORE INTO questions (id, title, topic, statement, input_format, output_format, constraints, example_input, example_output)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  questions.forEach((q, i) => {
    insertQuestion.run(i + 1, q.title, q.topic, q.statement, q.input_format, q.output_format, q.constraints, q.example_input, q.example_output);
  });

  // Seed test cases
  seedTestCases(db);

  console.log('Database seeded successfully');
}

function seedTestCases(db: ReturnType<typeof getDb>) {
  const insertTC = db.prepare(`
    INSERT OR IGNORE INTO test_cases (question_id, input, expected_output, type, is_visible, weight)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Check if test cases already exist
  const existing = db.prepare('SELECT COUNT(*) as count FROM test_cases').get() as { count: number };
  if (existing.count > 0) return;

  // Q1: Array Insertion
  const q1Cases = [
    ['5\n1 2 3 4 5\n10\n3', '1 2 10 3 4 5', 'visible', 1],
    ['3\n5 10 15\n7\n1', '7 5 10 15', 'visible', 1],
    ['4\n1 2 3 4\n99\n5', '1 2 3 4 99', 'hidden', 0],
    ['1\n42\n0\n1', '0 42', 'hidden', 0],
    ['6\n-5 -3 -1 0 2 4\n-2\n4', '-5 -3 -1 -2 0 2 4', 'edge', 0],
  ];
  q1Cases.forEach(([input, output, type, visible]) => insertTC.run(1, input, output, type, visible, 1));

  // Q2: Array Deletion
  const q2Cases = [
    ['5\n1 2 3 4 5\n3', '1 2 4 5', 'visible', 1],
    ['4\n10 20 30 40\n1', '20 30 40', 'visible', 1],
    ['3\n5 10 15\n3', '5 10', 'hidden', 0],
    ['2\n100 200\n2', '100', 'hidden', 0],
    ['5\n-5 -3 0 3 5\n2', '-5 0 3 5', 'edge', 0],
  ];
  q2Cases.forEach(([input, output, type, visible]) => insertTC.run(2, input, output, type, visible, 1));

  // Q3: Linear Search
  const q3Cases = [
    ['5\n10 20 30 40 50\n30', '3', 'visible', 1],
    ['4\n5 3 8 1\n8', '3', 'visible', 1],
    ['5\n1 2 3 4 5\n6', '-1', 'hidden', 0],
    ['1\n42\n42', '1', 'hidden', 0],
    ['5\n5 5 5 5 5\n5', '1', 'edge', 0],
  ];
  q3Cases.forEach(([input, output, type, visible]) => insertTC.run(3, input, output, type, visible, 1));

  // Q4: Binary Search
  const q4Cases = [
    ['6\n2 5 8 12 16 23\n12', '4', 'visible', 1],
    ['5\n1 3 5 7 9\n7', '4', 'visible', 1],
    ['5\n1 3 5 7 9\n4', '-1', 'hidden', 0],
    ['1\n100\n100', '1', 'hidden', 0],
    ['6\n2 5 8 12 16 23\n2', '1', 'edge', 0],
  ];
  q4Cases.forEach(([input, output, type, visible]) => insertTC.run(4, input, output, type, visible, 1));

  // Q5: Bubble Sort
  const q5Cases = [
    ['5\n64 34 25 12 22', '12 22 25 34 64', 'visible', 1],
    ['4\n4 3 2 1', '1 2 3 4', 'visible', 1],
    ['5\n1 2 3 4 5', '1 2 3 4 5', 'hidden', 0],
    ['3\n-3 -1 -2', '-3 -2 -1', 'hidden', 0],
    ['1\n42', '42', 'edge', 0],
    ['5\n5 5 5 5 5', '5 5 5 5 5', 'edge', 0],
  ];
  q5Cases.forEach(([input, output, type, visible]) => insertTC.run(5, input, output, type, visible, 1));

  // Q6: Insertion Sort
  const q6Cases = [
    ['5\n12 11 13 5 6', '5 6 11 12 13', 'visible', 1],
    ['4\n9 3 7 1', '1 3 7 9', 'visible', 1],
    ['5\n1 2 3 4 5', '1 2 3 4 5', 'hidden', 0],
    ['4\n-4 -1 -3 -2', '-4 -3 -2 -1', 'hidden', 0],
    ['1\n7', '7', 'edge', 0],
  ];
  q6Cases.forEach(([input, output, type, visible]) => insertTC.run(6, input, output, type, visible, 1));

  // Q7: Selection Sort
  const q7Cases = [
    ['5\n64 25 12 22 11', '11 12 22 25 64', 'visible', 1],
    ['4\n3 1 4 2', '1 2 3 4', 'visible', 1],
    ['5\n5 4 3 2 1', '1 2 3 4 5', 'hidden', 0],
    ['3\n-1 -3 -2', '-3 -2 -1', 'hidden', 0],
    ['1\n10', '10', 'edge', 0],
  ];
  q7Cases.forEach(([input, output, type, visible]) => insertTC.run(7, input, output, type, visible, 1));

  // Q8: Array Statistics
  const q8Cases = [
    ['5\n3 1 4 1 5', '14\n2.80\n5\n1', 'visible', 1],
    ['4\n10 20 30 40', '100\n25.00\n40\n10', 'visible', 1],
    ['3\n-5 0 5', '0\n0.00\n5\n-5', 'hidden', 0],
    ['1\n7', '7\n7.00\n7\n7', 'hidden', 0],
    ['5\n-10 -20 -30 -40 -50', '-150\n-30.00\n-10\n-50', 'edge', 0],
  ];
  q8Cases.forEach(([input, output, type, visible]) => insertTC.run(8, input, output, type, visible, 1));

  // Q9: Duplicate Elements
  const q9Cases = [
    ['7\n1 2 3 2 4 3 5', '2 3', 'visible', 1],
    ['5\n1 1 1 1 1', '1', 'visible', 1],
    ['4\n1 2 3 4', 'No duplicates found', 'hidden', 0],
    ['6\n-1 2 -1 3 2 4', '-1 2', 'hidden', 0],
    ['1\n5', 'No duplicates found', 'edge', 0],
  ];
  q9Cases.forEach(([input, output, type, visible]) => insertTC.run(9, input, output, type, visible, 1));
}
