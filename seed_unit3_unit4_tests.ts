import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Unit III & Unit IV Tests and Question Banks...');

  // 1. Ensure Subject exists
  let subject = await prisma.subject.findFirst({
    where: { code: 'DSA' }
  });
  if (!subject) {
    subject = await prisma.subject.findFirst({
      where: { name: { contains: 'DSA', mode: 'insensitive' } }
    });
  }
  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        code: 'DSA',
        name: 'Data Structures and Algorithms',
      }
    });
    console.log('Created Subject: DSA');
  }

  // 2. Find Admin / Teacher
  const adminUser = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'TEACHER'] } },
    orderBy: { created_at: 'asc' }
  });
  const teacher_id = adminUser ? adminUser.id : null;

  // =========================================================================
  // BANK 1: Unit III – Linked Lists (Puzzle Test)
  // =========================================================================
  const bank1Name = 'Unit III – Linked Lists (Puzzle Test)';
  let bank1 = await prisma.questionBank.findUnique({
    where: { name: bank1Name }
  });

  if (!bank1) {
    bank1 = await prisma.questionBank.create({
      data: {
        name: bank1Name,
        description: 'DSA Unit III — Linked List Puzzle Challenge. Traversal outputs, pointer connections, insertion, deletion, and reverse operations.',
        category: 'Linked Lists',
        subject_code: subject.code,
        total_marks: 30,
        duration_minutes: 30,
      }
    });
    console.log('Created Question Bank: ' + bank1Name);
  }

  // Create or Update Test 1
  let test1 = await prisma.test.findFirst({
    where: { unique_id: 'unit-3-linked-lists' }
  });

  const test1Data = {
    unique_id: 'unit-3-linked-lists',
    title: 'Unit III – Linked Lists (Puzzle Test)',
    description: 'DSA Unit III — Linked List Puzzle Challenge. Total Marks: 30 | Questions: 15 | Duration: 30 Mins.',
    instructions: '1. All 15 questions are compulsory.\n2. Carefully examine each linked list puzzle and pointer manipulation.\n3. Each question carries 2 marks.\n4. Fullscreen and anti-cheat monitoring are strictly enforced. Alt-Tab or leaving test window is allowed up to 3 times — on the 3rd violation your test will be automatically submitted.',
    subject_id: subject.id,
    teacher_id: teacher_id,
    duration_minutes: 30,
    total_marks: 30,
    questions_per_student: 15,
    test_type: 'QUIZ',
    auto_approve: false,
    marks_published: true,
    randomize_questions: false,
    status: 'PUBLISHED',
  };

  if (!test1) {
    test1 = await prisma.test.create({ data: test1Data });
    console.log('Created Test: unit-3-linked-lists');
  } else {
    test1 = await prisma.test.update({
      where: { id: test1.id },
      data: test1Data
    });
    console.log('Updated Test: unit-3-linked-lists');
  }

  // Questions for Unit III
  const unit3Questions = [
    {
      order_index: 1,
      type: 'SHORT_ANSWER',
      question_text: 'Find the output (2 marks)\nGiven the linked list:\n10 → 20 → 30 → NULL\nWhat is printed by the following code?',
      code_snippet: 'cout << head->data;',
      correct_answer: '10',
      alternate_answers: ['10', 'Output: 10', '10\n'],
      explanation: 'head points to the first node of the list, which has data = 10. Executing cout << head->data prints 10.',
      marks: 2,
    },
    {
      order_index: 2,
      type: 'SHORT_ANSWER',
      question_text: 'Find the new head (2 marks)\nInitially:\n5 → 10 → 15 → NULL\nAfter executing head = head->next;, which node becomes the head?',
      code_snippet: 'head = head->next;',
      correct_answer: '10',
      alternate_answers: ['Node 10', 'node 10', '10', 'Node with value 10', 'Node with data 10'],
      explanation: 'head initially points to node 5. head->next points to node 10. Executing head = head->next moves head to node 10.',
      marks: 2,
    },
    {
      order_index: 3,
      type: 'SHORT_ANSWER',
      question_text: 'Complete the link (2 marks)\nGiven:\n10 → 20 → NULL\nWrite the statement to connect node 20 to node 30, assuming temp points to node 20 and n1 points to node 30.',
      code_snippet: '// temp points to 20, n1 points to 30',
      correct_answer: 'temp->next = n1;',
      alternate_answers: ['temp->next = n1', 'temp->next=n1;', 'temp->next=n1'],
      explanation: 'To attach node 30 (pointed by n1) after node 20 (pointed by temp), we set temp->next = n1;.',
      marks: 2,
    },
    {
      order_index: 4,
      type: 'SHORT_ANSWER',
      question_text: 'Identify the error (2 marks)\nWhich statement is missing to move to the next node inside the while loop?',
      code_snippet: 'while (temp != NULL)\n{\n    cout << temp->data;\n}',
      correct_answer: 'temp = temp->next;',
      alternate_answers: ['temp = temp->next', 'temp=temp->next;', 'temp=temp->next', 'temp = temp -> next;'],
      explanation: 'Without advancing temp via temp = temp->next;, the loop creates an infinite loop printing the first node forever.',
      marks: 2,
    },
    {
      order_index: 5,
      type: 'SHORT_ANSWER',
      question_text: 'Predict the output (2 marks)\nList: 1 → 2 → 3 → NULL\nWhat is the output of the following code?',
      code_snippet: 'cout << head->next->data;',
      correct_answer: '2',
      alternate_answers: ['2', 'Output: 2', '2\n'],
      explanation: 'head points to node 1. head->next points to node 2. Therefore, head->next->data is 2.',
      marks: 2,
    },
    {
      order_index: 6,
      type: 'SHORT_ANSWER',
      question_text: 'Insert at beginning (2 marks)\nInitially:\n20 → 30 → NULL\nInsert node 10 at the beginning. Write the resulting linked list.',
      code_snippet: '// Initial list: 20 -> 30 -> NULL\n// Insert node 10 at beginning',
      correct_answer: '10 → 20 → 30 → NULL',
      alternate_answers: ['10 -> 20 -> 30 -> NULL', '10->20->30->NULL', '10, 20, 30', '10 20 30', '10 -> 20 -> 30'],
      explanation: 'Inserting 10 at the beginning gives: 10 → 20 → 30 → NULL.',
      marks: 2,
    },
    {
      order_index: 7,
      type: 'SHORT_ANSWER',
      question_text: 'Delete the first node (2 marks)\nInitially:\n10 → 20 → 30 → NULL\nAfter deleting the first node, what is the resulting list?',
      code_snippet: '// Initial list: 10 -> 20 -> 30 -> NULL\n// Delete head node',
      correct_answer: '20 → 30 → NULL',
      alternate_answers: ['20 -> 30 -> NULL', '20->30->NULL', '20, 30', '20 30', '20 -> 30'],
      explanation: 'Deleting node 10 causes head to point to node 20, resulting in: 20 → 30 → NULL.',
      marks: 2,
    },
    {
      order_index: 8,
      type: 'SHORT_ANSWER',
      question_text: 'Count the nodes (2 marks)\nHow many nodes are present in this list?\n5 → 10 → 15 → 20 → NULL',
      code_snippet: '5 -> 10 -> 15 -> 20 -> NULL',
      correct_answer: '4',
      alternate_answers: ['4 nodes', '4', 'Four'],
      explanation: 'The nodes with values 5, 10, 15, and 20 make 4 nodes in total.',
      marks: 2,
    },
    {
      order_index: 9,
      type: 'SHORT_ANSWER',
      question_text: 'Find the last node (2 marks)\nGiven:\n11 → 22 → 33 → NULL\nWhat condition identifies the last node of a singly linked list?',
      code_snippet: '11 -> 22 -> 33 -> NULL',
      correct_answer: 'node->next == NULL',
      alternate_answers: ['temp->next == NULL', 'next == NULL', 'node->next == nullptr', 'temp->next == nullptr', 'ptr->next == NULL', 'next == nullptr', 'node->next==NULL'],
      explanation: 'In a singly linked list, the last node has its next pointer equal to NULL (or nullptr in C++).',
      marks: 2,
    },
    {
      order_index: 10,
      type: 'SHORT_ANSWER',
      question_text: 'Reverse the list (2 marks)\nWrite the resulting order after reversing:\n1 → 2 → 3 → NULL',
      code_snippet: '1 -> 2 -> 3 -> NULL',
      correct_answer: '3 → 2 → 1 → NULL',
      alternate_answers: ['3 -> 2 -> 1 -> NULL', '3->2->1->NULL', '3, 2, 1', '3 2 1', '3 -> 2 -> 1'],
      explanation: 'Reversing the links flips the traversal order to: 3 → 2 → 1 → NULL.',
      marks: 2,
    },
    {
      order_index: 11,
      type: 'SHORT_ANSWER',
      question_text: 'Circular linked-list puzzle (2 marks)\nA circular list is A → B → C → A. Which node does C->next point to?',
      code_snippet: 'A -> B -> C -> A',
      correct_answer: 'A',
      alternate_answers: ['Node A', 'node A', 'A', 'head'],
      explanation: 'In a circular linked list, the last node (C) loops back and points to the first node (A).',
      marks: 2,
    },
    {
      order_index: 12,
      type: 'SHORT_ANSWER',
      question_text: 'Doubly linked-list puzzle (2 marks)\nIn a doubly linked list, which pointer of node 20 points to node 10?\n10 ⇄ 20 ⇄ 30',
      code_snippet: '10 <-> 20 <-> 30',
      correct_answer: 'prev',
      alternate_answers: ['prev', 'previous', 'prev pointer', 'node->prev', 'left', 'left pointer', 'previous pointer'],
      explanation: 'In a doubly linked list node, the prev (previous) pointer points to the predecessor node (10), while next points to 30.',
      marks: 2,
    },
    {
      order_index: 13,
      type: 'SHORT_ANSWER',
      question_text: 'Find the next node (2 marks)\nGiven:\n100 → 200 → 300 → NULL\nIf temp points to node 200, what is the value of temp->next->data?',
      code_snippet: '// temp points to node 200\n// temp->next->data = ?',
      correct_answer: '300',
      alternate_answers: ['300', 'Output: 300', '300\n'],
      explanation: 'temp points to 200. temp->next points to node 300. Thus temp->next->data evaluates to 300.',
      marks: 2,
    },
    {
      order_index: 14,
      type: 'SHORT_ANSWER',
      question_text: 'Identify the empty list (2 marks)\nWhat value does head contain when a linked list is empty in the usual C++ implementation?',
      code_snippet: '// Node* head = ?; // when list is empty',
      correct_answer: 'NULL',
      alternate_answers: ['nullptr', 'NULL', 'null', '0'],
      explanation: 'An empty linked list is signified by head = NULL (or nullptr in C++11 and later).',
      marks: 2,
    },
    {
      order_index: 15,
      type: 'SHORT_ANSWER',
      question_text: 'Arrange the final list (2 marks)\nInitially:\n10 → 20 → 30 → NULL\nInsert 5 at the beginning. Then insert 40 at the end. Write the final linked list.',
      code_snippet: '// Initial: 10 -> 20 -> 30 -> NULL\n// 1. Insert 5 at beginning\n// 2. Insert 40 at end',
      correct_answer: '5 → 10 → 20 → 30 → 40 → NULL',
      alternate_answers: ['5 -> 10 -> 20 -> 30 -> 40 -> NULL', '5->10->20->30->40->NULL', '5, 10, 20, 30, 40', '5 10 20 30 40'],
      explanation: 'Inserting 5 at front gives 5 → 10 → 20 → 30 → NULL. Appending 40 gives: 5 → 10 → 20 → 30 → 40 → NULL.',
      marks: 2,
    },
  ];

  // Clean old questions for test1 and bank1
  await prisma.quizQuestion.deleteMany({
    where: { OR: [{ test_id: test1.id }, { bank_id: bank1.id }] }
  });

  // Insert questions into both Bank and Test
  for (const q of unit3Questions) {
    await prisma.quizQuestion.create({
      data: {
        test_id: test1.id,
        bank_id: bank1.id,
        bank_name: bank1Name,
        type: q.type,
        question_text: q.question_text,
        code_snippet: q.code_snippet,
        correct_answer: q.correct_answer,
        alternate_answers: q.alternate_answers,
        explanation: q.explanation,
        marks: q.marks,
        order_index: q.order_index,
      }
    });
  }
  console.log(`Successfully added 15 questions to ${bank1Name} and Test 1!`);

  // =========================================================================
  // BANK 2: Unit IV – Stacks (Quiz Test)
  // =========================================================================
  const bank2Name = 'Unit IV – Stacks (Quiz Test)';
  let bank2 = await prisma.questionBank.findUnique({
    where: { name: bank2Name }
  });

  if (!bank2) {
    bank2 = await prisma.questionBank.create({
      data: {
        name: bank2Name,
        description: 'Unit IV: Stacks and Recursion – Final Test. Section A (10 x 1 mark) & Section B (10 x 2 marks).',
        category: 'Stacks & Recursion',
        subject_code: subject.code,
        total_marks: 30,
        duration_minutes: 20,
      }
    });
    console.log('Created Question Bank: ' + bank2Name);
  }

  // Create or Update Test 2
  let test2 = await prisma.test.findFirst({
    where: { unique_id: 'unit-4-stacks' }
  });

  const test2Data = {
    unique_id: 'unit-4-stacks',
    title: 'Unit IV – Stacks (Quiz Test)',
    description: 'Unit IV: Stacks and Recursion – Final Test. Total Marks: 30 | Questions: 20 | Duration: 20 Mins.',
    instructions: '1. All 20 questions are compulsory.\n2. Section A: 10 Questions carrying 1 mark each.\n3. Section B: 10 Questions carrying 2 marks each.\n4. Show/trace steps for expression conversions and recursion functions.\n5. Fullscreen and anti-cheat monitoring are strictly enforced. Alt-Tab or leaving test window is allowed up to 3 times — on the 3rd violation your test will be automatically submitted.',
    subject_id: subject.id,
    teacher_id: teacher_id,
    duration_minutes: 20,
    total_marks: 30,
    questions_per_student: 20,
    test_type: 'QUIZ',
    auto_approve: false,
    marks_published: true,
    randomize_questions: false,
    status: 'PUBLISHED',
  };

  if (!test2) {
    test2 = await prisma.test.create({ data: test2Data });
    console.log('Created Test: unit-4-stacks');
  } else {
    test2 = await prisma.test.update({
      where: { id: test2.id },
      data: test2Data
    });
    console.log('Updated Test: unit-4-stacks');
  }

  // Questions for Unit IV (10 x 1 mark + 10 x 2 marks = 20 questions, 30 marks)
  const unit4Questions = [
    // Section A: 1-Mark Questions (Q1 - Q10)
    {
      order_index: 1,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ1. Which principle does a stack follow?',
      code_snippet: null,
      correct_answer: 'LIFO',
      alternate_answers: ['Last In First Out', 'Last-In First-Out', 'Last In, First Out', 'LIFO (Last In First Out)', 'LIFO principle'],
      explanation: 'A stack operates on the LIFO (Last In, First Out) principle, where the last element inserted is the first to be retrieved.',
      marks: 1,
    },
    {
      order_index: 2,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ2. Define the POP operation.',
      code_snippet: null,
      correct_answer: 'Removal of the top element from the stack',
      alternate_answers: ['Remove top element', 'Deleting top element', 'Deletes element from top', 'Removing top item from stack', 'Pop removes top element', 'Remove element from top of stack'],
      explanation: 'POP is the stack operation that removes and returns the element at the top of the stack.',
      marks: 1,
    },
    {
      order_index: 3,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ3. What is stack underflow?',
      code_snippet: null,
      correct_answer: 'Attempting to pop an element from an empty stack',
      alternate_answers: ['Pop from empty stack', 'Popping when stack is empty', 'Deleting from empty stack', 'When stack is empty and pop is called', 'Removing from empty stack'],
      explanation: 'Stack underflow occurs when a POP operation is performed on an empty stack.',
      marks: 1,
    },
    {
      order_index: 4,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ4. Name the three common expression notations.',
      code_snippet: null,
      correct_answer: 'Infix, Prefix, Postfix',
      alternate_answers: ['Infix Prefix Postfix', 'Infix, Postfix, Prefix', 'Prefix, Infix, Postfix', 'Infix, Prefix and Postfix', 'Infix, Postfix and Prefix'],
      explanation: 'The three common notations for arithmetic expressions are Infix (A+B), Prefix (+AB), and Postfix (AB+).',
      marks: 1,
    },
    {
      order_index: 5,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ5. Write the postfix form of A + B.',
      code_snippet: null,
      correct_answer: 'AB+',
      alternate_answers: ['A B +', 'AB +'],
      explanation: 'In postfix notation, the operator is placed after its operands: A + B becomes AB+.',
      marks: 1,
    },
    {
      order_index: 6,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ6. Which data structure is used for infix-to-postfix conversion?',
      code_snippet: null,
      correct_answer: 'Stack',
      alternate_answers: ['A stack', 'Stack data structure'],
      explanation: 'A stack is used to maintain operators and parenthetical precedence during infix-to-postfix conversion.',
      marks: 1,
    },
    {
      order_index: 7,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ7. What is a linked stack?',
      code_snippet: null,
      correct_answer: 'A stack implemented using a linked list',
      alternate_answers: ['Stack using linked list', 'Stack implemented with linked list', 'Linked list implementation of stack', 'Stack implemented using singly linked list'],
      explanation: 'A linked stack is a dynamic stack implementation where elements are nodes in a linked list and the top pointer refers to the head node.',
      marks: 1,
    },
    {
      order_index: 8,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ8. Define recursion.',
      code_snippet: null,
      correct_answer: 'A process in which a function calls itself directly or indirectly',
      alternate_answers: ['Function calling itself', 'When a function calls itself', 'A function that calls itself', 'Function calls itself'],
      explanation: 'Recursion is a programming approach in which a function calls itself to solve a smaller instance of the same problem.',
      marks: 1,
    },
    {
      order_index: 9,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ9. What is a base condition in recursion?',
      code_snippet: null,
      correct_answer: 'The terminating condition that stops recursion',
      alternate_answers: ['Condition to terminate recursion', 'Stopping condition', 'Termination condition', 'Condition that stops function calling itself', 'Base case that terminates recursion'],
      explanation: 'The base condition specifies when the recursive calls should terminate, preventing an infinite recursive loop.',
      marks: 1,
    },
    {
      order_index: 10,
      type: 'SHORT_ANSWER',
      question_text: 'Section A (1 Mark)\nQ10. Define direct recursion.',
      code_snippet: null,
      correct_answer: 'When a function explicitly calls itself directly from within its body',
      alternate_answers: ['Function calls itself directly', 'When a function calls itself', 'Direct call to the same function', 'A function calls itself directly'],
      explanation: 'Direct recursion occurs when a function explicitly invokes itself within its own definition without intermediate calls.',
      marks: 1,
    },

    // Section B: 2-Mark Questions (Q11 - Q20)
    {
      order_index: 11,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ11. Explain PUSH and POP operations with a suitable example.',
      code_snippet: null,
      correct_answer: 'PUSH adds an element to the top of the stack. POP removes and returns the top element from the stack.',
      alternate_answers: [
        'Push inserts element at top, Pop deletes element from top',
        'PUSH inserts, POP removes from top',
        'PUSH adds an element to stack, POP removes the top element',
        'Push adds element to top of stack, Pop removes top element'
      ],
      explanation: 'PUSH: Inserts an element at the top of the stack (e.g. push(10) places 10 on top). POP: Removes the top element from the stack (e.g. pop() removes and returns 10).',
      marks: 2,
    },
    {
      order_index: 12,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ12. Differentiate between stack overflow and stack underflow.',
      code_snippet: null,
      correct_answer: 'Stack overflow occurs when attempting to push onto a full stack. Stack underflow occurs when attempting to pop from an empty stack.',
      alternate_answers: [
        'Overflow: push on full stack; Underflow: pop from empty stack',
        'Overflow happens when stack is full, underflow happens when stack is empty',
        'Overflow is pushing to full stack, underflow is popping from empty stack',
        'Overflow: stack is full. Underflow: stack is empty.'
      ],
      explanation: 'Stack Overflow: Attempting to insert (PUSH) into a stack that has reached maximum capacity. Stack Underflow: Attempting to delete (POP) from a stack that has no elements.',
      marks: 2,
    },
    {
      order_index: 13,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ13. Convert the infix expression into postfix notation:\nA + B * C',
      code_snippet: 'A + B * C',
      correct_answer: 'ABC*+',
      alternate_answers: ['A B C * +', 'ABC * +', 'A B C*+'],
      explanation: 'Multiplication (*) has higher precedence than addition (+). Thus B * C converts to BC*. Then A + (BC*) becomes ABC*+.',
      marks: 2,
    },
    {
      order_index: 14,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ14. Convert the infix expression into postfix notation:\n(A + B) * C',
      code_snippet: '(A + B) * C',
      correct_answer: 'AB+C*',
      alternate_answers: ['A B + C *', 'AB+ C *', 'AB+ C*'],
      explanation: 'Parentheses have higher precedence than (*). Thus (A + B) converts first to AB+. Then (AB+) * C becomes AB+C*.',
      marks: 2,
    },
    {
      order_index: 15,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ15. Convert the infix expression into prefix notation:\nA + B * C',
      code_snippet: 'A + B * C',
      correct_answer: '+A*BC',
      alternate_answers: ['+ A * B C', '+A *BC', '+ A *BC'],
      explanation: 'Multiplication has higher precedence: B * C becomes *BC. Then A + (*BC) becomes +A*BC.',
      marks: 2,
    },
    {
      order_index: 16,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ16. Evaluate the postfix expression using a stack:\n5 3 + 2 *',
      code_snippet: '5 3 + 2 *',
      correct_answer: '16',
      alternate_answers: ['16', '16.0', 'Output: 16', 'Result: 16'],
      explanation: "1. Push 5, Push 3.\n2. '+': 5 + 3 = 8, Push 8.\n3. Push 2.\n4. '*': 8 * 2 = 16, Push 16.\nResult: 16.",
      marks: 2,
    },
    {
      order_index: 17,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ17. Evaluate the postfix expression using a stack:\n8 2 / 3 +',
      code_snippet: '8 2 / 3 +',
      correct_answer: '7',
      alternate_answers: ['7', '7.0', 'Output: 7', 'Result: 7'],
      explanation: "1. Push 8, Push 2.\n2. '/': 8 / 2 = 4, Push 4.\n3. Push 3.\n4. '+': 4 + 3 = 7, Push 7.\nResult: 7.",
      marks: 2,
    },
    {
      order_index: 18,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ18. Explain the PUSH operation in a linked stack.',
      code_snippet: null,
      correct_answer: 'Create a new node, set newNode->next = top, and update top = newNode.',
      alternate_answers: [
        'newNode->next = top; top = newNode',
        'newNode->next = top; top = newNode;',
        'Allocate new node, point its next to top, make top point to new node',
        'Insert new node at top of linked list',
        'newNode->next = top and top = newNode'
      ],
      explanation: 'To PUSH in a linked stack: 1. Allocate a new node with data. 2. Point new node next to current top: newNode->next = top. 3. Update top: top = newNode.',
      marks: 2,
    },
    {
      order_index: 19,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ19. Differentiate between direct recursion and indirect recursion.',
      code_snippet: null,
      correct_answer: 'In direct recursion, a function calls itself directly. In indirect recursion, a function calls another function which eventually calls the original function.',
      alternate_answers: [
        'Direct: function calls itself directly. Indirect: function calls another function which calls first function',
        'Direct calls itself, indirect calls via another function',
        'Direct: A calls A. Indirect: A calls B and B calls A',
        'Direct recursion calls itself directly, indirect recursion involves two or more functions calling each other'
      ],
      explanation: 'Direct recursion: A function calls itself directly (A -> A). Indirect recursion: A function calls another function, which in turn calls the first function (A -> B -> A).',
      marks: 2,
    },
    {
      order_index: 20,
      type: 'SHORT_ANSWER',
      question_text: 'Section B (2 Marks)\nQ20. Trace the output of the following function for display(3).',
      code_snippet: 'void display(int n)\n{\n    if (n == 0)\n        return;\n    display(n - 1);\n    cout << n << " ";\n}',
      correct_answer: '1 2 3',
      alternate_answers: ['1 2 3 ', '1 2 3', '1, 2, 3', '1 2 3\n'],
      explanation: 'display(3) calls display(2) -> display(1) -> display(0). When returning: display(1) prints 1, display(2) prints 2, display(3) prints 3. Final output: 1 2 3 .',
      marks: 2,
    },
  ];

  // Clean old questions for test2 and bank2
  await prisma.quizQuestion.deleteMany({
    where: { OR: [{ test_id: test2.id }, { bank_id: bank2.id }] }
  });

  // Insert questions into both Bank and Test
  for (const q of unit4Questions) {
    await prisma.quizQuestion.create({
      data: {
        test_id: test2.id,
        bank_id: bank2.id,
        bank_name: bank2Name,
        type: q.type,
        question_text: q.question_text,
        code_snippet: q.code_snippet,
        correct_answer: q.correct_answer,
        alternate_answers: q.alternate_answers,
        explanation: q.explanation,
        marks: q.marks,
        order_index: q.order_index,
      }
    });
  }
  console.log(`Successfully added 20 questions to ${bank2Name} and Test 2!`);

  console.log('Seeding completed successfully!');
}

main()
  .catch(e => {
    console.error('Error seeding tests:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
