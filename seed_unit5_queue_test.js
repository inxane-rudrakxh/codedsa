const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const questions = [
  ['Which principle is followed by a queue?', ['LIFO', 'FIFO', 'FILO', 'Random Access'], 'FIFO', 'A queue follows FIFO: the element inserted first is removed first.'],
  ['Which operation is used to insert an element into a queue?', ['Push', 'Pop', 'Enqueue', 'Delete'], 'Enqueue', 'Enqueue inserts an element at the rear of a queue.'],
  ['Which operation is used to remove an element from a queue?', ['Enqueue', 'Dequeue', 'Insert', 'Traverse'], 'Dequeue', 'Dequeue removes an element from the front of a queue.'],
  ['In a queue, insertion is performed at which end?', ['Front', 'Middle', 'Rear', 'Both ends'], 'Rear', 'Insertion in a standard queue takes place at the rear.'],
  ['In a queue, deletion is performed from which end?', ['Rear', 'Front', 'Middle', 'Any position'], 'Front', 'Deletion in a standard queue takes place at the front.'],
  ['Which condition indicates that an array-based linear queue is empty?', ['front == rear', 'front == -1', 'rear == 0', 'rear == MAX'], 'front == -1', 'A front value of -1 indicates that the linear queue is empty.'],
  ['Initially, what values are assigned to front and rear in an empty array-based queue?', ['front = 0, rear = 0', 'front = 1, rear = 1', 'front = -1, rear = -1', 'front = 0, rear = -1'], 'front = -1, rear = -1', 'Both pointers are initialized to -1 for an empty array-based queue.'],
  ['What is the condition for queue overflow in a linear queue of size MAX?', ['rear == -1', 'front == -1', 'rear == MAX - 1', 'front == MAX - 1'], 'rear == MAX - 1', 'In a linear array queue, overflow occurs when the rear reaches MAX - 1.'],
  ['What is the condition for queue underflow?', ['Inserting into a full queue', 'Deleting from an empty queue', 'Inserting into an empty queue', 'Traversing a queue'], 'Deleting from an empty queue', 'Queue underflow occurs when a dequeue is attempted on an empty queue.'],
  ['Which of the following is a disadvantage of a linear queue implemented using an array?', ['It cannot store integers', 'It wastes memory due to unused positions at the beginning', 'It cannot perform deletion', 'It requires dynamic memory allocation'], 'It wastes memory due to unused positions at the beginning', 'After front moves forward, unused positions at the beginning cannot be reused by a linear queue.'],
  ['Which data structure overcomes the memory wastage problem of a linear queue?', ['Stack', 'Circular Queue', 'Tree', 'Graph'], 'Circular Queue', 'A circular queue reuses freed positions by wrapping the rear and front pointers.'],
  ['In a circular queue, the last position is connected to:', ['The middle position', 'The first position', 'The previous position', 'NULL'], 'The first position', 'In a circular queue, the last array position wraps around to the first position.'],
  ['Which formula is used to move the rear pointer in a circular queue?', ['rear = rear + 1', 'rear = rear - 1', 'rear = (rear + 1) % MAX', 'rear = rear * 2'], 'rear = (rear + 1) % MAX', 'Modulo MAX makes the rear pointer wrap around to index zero.'],
  ['In a circular queue, the queue is full when:', ['front == -1', 'rear == -1', '(rear + 1) % MAX == front', 'front == rear'], '(rear + 1) % MAX == front', 'Fullness is detected when the next rear position is the front position.'],
  ['A circular queue has a size of 5. If rear = 4, what will be the next rear position after insertion?', ['4', '5', '0', '-1'], '0', 'The next position is (4 + 1) % 5 = 0.'],
  ['Which of the following is an application of a queue?', ['Function call management', 'Undo operation', 'CPU task scheduling', 'Expression evaluation using stack'], 'CPU task scheduling', 'Task scheduling commonly uses queues to process jobs in a defined order.'],
  ['Which data structure is used in Breadth First Search (BFS)?', ['Stack', 'Queue', 'Linked List only', 'Binary Search Tree'], 'Queue', 'BFS explores vertices level by level using a queue.'],
  ['Which type of queue allows insertion and deletion at both ends?', ['Linear Queue', 'Circular Queue', 'Double Ended Queue', 'Priority Queue'], 'Double Ended Queue', 'A deque, or double-ended queue, supports operations at both ends.'],
  ['In a priority queue, elements are deleted based on:', ['Their insertion order only', 'Their priority', 'Their memory address', 'Their size'], 'Their priority', 'A priority queue removes elements according to their assigned priority.'],
  ['Which queue gives higher priority to an element with the highest priority value, assuming larger values represent higher priority?', ['Simple Queue', 'Circular Queue', 'Priority Queue', 'Linear Queue'], 'Priority Queue', 'A priority queue selects elements according to their priority values.'],
  ['In a simple queue, if elements 10, 20, and 30 are inserted in that order, which element will be deleted first?', ['30', '20', '10', 'None'], '10', 'FIFO deletion removes 10, the first inserted element.'],
  ['Consider a queue with elements 5, 10, 15. After one dequeue operation, what will be the front element?', ['5', '10', '15', 'Queue becomes empty'], '10', 'Dequeuing 5 leaves 10 at the front.'],
  ['What is the time complexity of enqueue operation in a queue when the rear pointer is maintained?', ['O(1)', 'O(n)', 'O(log n)', 'O(n^2)'], 'O(1)', 'Maintaining a rear pointer permits enqueue insertion in constant time.'],
  ['What is the time complexity of dequeue operation in a queue when the front pointer is maintained?', ['O(n)', 'O(n^2)', 'O(1)', 'O(log n)'], 'O(1)', 'Maintaining a front pointer permits dequeue removal in constant time.'],
  ['Which of the following is true about a queue implemented using a linked list?', ['It has a fixed size', 'It requires a predefined array size', 'It can grow dynamically as memory is available', 'It follows LIFO'], 'It can grow dynamically as memory is available', 'A linked-list queue allocates nodes dynamically and is not limited by a fixed array size.'],
  ['In a linked-list implementation of a queue, which pointer is used to insert a new node efficiently?', ['Top', 'Rear', 'Root', 'Middle'], 'Rear', 'The rear pointer references the last node and allows efficient insertion.'],
  ['A printer receives three print jobs: A, B, and C, in that order. If a simple FIFO queue is used, which job will be processed first?', ['C', 'B', 'A', 'All at once'], 'A', 'In FIFO order, job A, which arrived first, is processed first.'],
  ['A CPU task scheduler uses a priority queue. Which task should be selected first if smaller priority numbers indicate higher priority?', ['Task with priority 5', 'Task with priority 3', 'Task with priority 1', 'Task with priority 8'], 'Task with priority 1', 'Smaller priority numbers indicate higher priority, so priority 1 is selected first.'],
  ['What happens when a dequeue operation is performed on an empty queue?', ['Overflow', 'Underflow', 'Insertion', 'Traversal'], 'Underflow', 'Dequeuing from an empty queue causes queue underflow.'],
  ['Which of the following statements about a queue is correct?', ['Insertion and deletion both take place at the front', 'Insertion takes place at the front and deletion at the rear', 'Insertion takes place at the rear and deletion at the front', 'Insertion and deletion both take place at the rear'], 'Insertion takes place at the rear and deletion at the front', 'A standard queue inserts at the rear and deletes at the front.'],
];

async function main() {
  const subject = await prisma.subject.upsert({
    where: { code: 'DSA' },
    update: { name: 'Data Structures and Algorithms' },
    create: { code: 'DSA', name: 'Data Structures and Algorithms' },
  });

  const admin = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'TEACHER'] } },
    orderBy: { created_at: 'asc' },
  });
  const teacherId = admin?.id ?? null;

  const bankName = 'DSA – MCQ Test: Unit V (Queue)';
  const bank = await prisma.questionBank.upsert({
    where: { name: bankName },
    update: {
      description: 'Unit V Queue MCQ test with 30 questions carrying 1 mark each.',
      category: 'QUIZ',
      subject_code: subject.code,
      total_marks: 30,
      duration_minutes: 30,
    },
    create: {
      name: bankName,
      description: 'Unit V Queue MCQ test with 30 questions carrying 1 mark each.',
      category: 'QUIZ',
      subject_code: subject.code,
      total_marks: 30,
      duration_minutes: 30,
    },
  });

  await prisma.quizQuestion.deleteMany({
    where: { bank_id: bank.id, test_id: null },
  });

  for (let i = 0; i < questions.length; i++) {
    const [text, options, answer, explanation] = questions[i];
    await prisma.quizQuestion.create({
      data: {
        test_id: null,
        bank_id: bank.id,
        bank_name: bankName,
        type: 'MCQ',
        question_text: `Q${i + 1}. ${text}`,
        options,
        correct_answer: answer,
        alternate_answers: [],
        explanation,
        marks: 1,
        order_index: i + 1,
      },
    });
  }

  const testUniqueId = 'unit-5-queue';
  const testData = {
    title: 'DSA – MCQ Test: Unit V (Queue)',
    description: 'F.Y. B.Tech. – AI&DS. Total Marks: 30 | Questions: 30 | 1 Mark Each.',
    instructions: 'All 30 questions are compulsory. Each question carries 1 mark. Select the correct option and submit before the timer expires.',
    subject_id: subject.id,
    teacher_id: teacherId,
    duration_minutes: 30,
    total_marks: 30,
    questions_per_student: 30,
    test_type: 'QUIZ',
    auto_approve: false,
    marks_published: true,
    randomize_questions: false,
    status: 'PUBLISHED',
  };

  let test = await prisma.test.findUnique({ where: { unique_id: testUniqueId } });
  test = test
    ? await prisma.test.update({ where: { id: test.id }, data: testData })
    : await prisma.test.create({ data: { ...testData, unique_id: testUniqueId } });

  await prisma.quizQuestion.deleteMany({ where: { test_id: test.id } });
  for (let i = 0; i < questions.length; i++) {
    const [text, options, answer, explanation] = questions[i];
    await prisma.quizQuestion.create({
      data: {
        test_id: test.id,
        bank_id: bank.id,
        bank_name: bankName,
        type: 'MCQ',
        question_text: `Q${i + 1}. ${text}`,
        options,
        correct_answer: answer,
        alternate_answers: [],
        explanation,
        marks: 1,
        order_index: i + 1,
      },
    });
  }

  console.log(`Published Unit V Queue quiz: bank=${bank.id}, test=${test.id}, questions=${questions.length}`);
}

main()
  .catch((error) => {
    console.error('Unit V Queue seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
