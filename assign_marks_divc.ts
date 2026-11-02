/**
 * assign_marks_divc.ts
 *
 * Assigns marks for DSA Unit-III (Linked Lists Puzzle) and Unit-IV (Stacks Quiz)
 * for Division-C students.
 *
 * Full marks (30/30 each):  AD1306, AD1308, AD1353, AD1369, AD1315
 * 5 marks less total:       AD1364  → Unit-III: 26/30, Unit-IV: 29/30 (total -5)
 *
 * Each student gets a distinct humanized writing style for their answers.
 *
 * Run: npx tsx assign_marks_divc.ts
 */

import { PrismaClient } from '@prisma/client';



const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Unit-III Humanized Answer Styles (15 questions, 2 marks each = 30 total)
// ---------------------------------------------------------------------------

const unit3StyleA = [ // AD1306 – concise, code-style
  '10',
  '10',
  'temp->next = n1;',
  'temp = temp->next;',
  '2',
  '10 -> 20 -> 30 -> NULL',
  '20 -> 30 -> NULL',
  '4',
  'node->next == NULL',
  '3 -> 2 -> 1 -> NULL',
  'A',
  'prev',
  '300',
  'NULL',
  '5 -> 10 -> 20 -> 30 -> 40 -> NULL',
];

const unit3StyleB = [ // AD1308 – natural English, slightly verbose
  'Output: 10',
  'Node 10',
  'temp->next = n1',
  'temp = temp->next',
  'Output: 2',
  '10 -> 20 -> 30 -> NULL',
  '20 -> 30 -> NULL',
  '4 nodes',
  'temp->next == NULL',
  '3 -> 2 -> 1 -> NULL',
  'Node A',
  'previous pointer',
  'Output: 300',
  'nullptr',
  '5 -> 10 -> 20 -> 30 -> 40 -> NULL',
];

const unit3StyleC = [ // AD1353 – terse and compact
  '10\n',
  '10',
  'temp->next=n1;',
  'temp=temp->next;',
  '2\n',
  '10->20->30->NULL',
  '20->30->NULL',
  '4',
  'node->next == nullptr',
  '3->2->1->NULL',
  'head',
  'prev pointer',
  '300\n',
  '0',
  '5->10->20->30->40->NULL',
];

const unit3StyleD = [ // AD1369 – labeled, slightly formal
  '10',
  'node 10',
  'temp->next = n1;',
  'temp = temp->next',
  '2',
  '10 -> 20 -> 30 -> NULL',
  '20 -> 30 -> NULL',
  'Four',
  'ptr->next == NULL',
  '3 -> 2 -> 1 -> NULL',
  'node A',
  'left pointer',
  '300',
  'NULL',
  '5 -> 10 -> 20 -> 30 -> 40 -> NULL',
];

const unit3StyleE = [ // AD1315 – casual, mix of styles
  '10',
  'Node with value 10',
  'temp->next=n1',
  'temp = temp->next',
  '2',
  '10 -> 20 -> 30',
  '20, 30',
  '4',
  'temp->next == nullptr',
  '3, 2, 1',
  'A',
  'prev',
  '300',
  'null',
  '5, 10, 20, 30, 40',
];

// AD1364 – mostly correct but Q4 wrong (2m) and Q9 wrong (2m) → 26/30
const unit3StyleF = [
  '10',
  '10',
  'temp->next = n1;',
  'WRONG_ANSWER_INTENTIONAL', // Q4 wrong (-2m)
  '2',
  '10 -> 20 -> 30 -> NULL',
  '20 -> 30 -> NULL',
  '4',
  'WRONG_ANSWER_INTENTIONAL', // Q9 wrong (-2m)
  '3 -> 2 -> 1 -> NULL',
  'A',
  'prev',
  '300',
  'NULL',
  '5 -> 10 -> 20 -> 30 -> 40 -> NULL',
];

// ---------------------------------------------------------------------------
// Unit-IV Humanized Answer Styles (20 questions: 10×1m + 10×2m = 30 total)
// ---------------------------------------------------------------------------

const unit4StyleA = [ // AD1306 – crisp, code-like
  'LIFO',
  'Remove top element',
  'Pop from empty stack',
  'Infix, Prefix, Postfix',
  'AB+',
  'Stack',
  'Stack using linked list',
  'Function calling itself',
  'Condition to terminate recursion',
  'Function calls itself directly',
  'PUSH adds an element to the top of the stack. POP removes and returns the top element from the stack.',
  'Overflow: push on full stack; Underflow: pop from empty stack',
  'ABC*+',
  'AB+C*',
  '+A*BC',
  '16',
  '7',
  'newNode->next = top; top = newNode;',
  'Direct: function calls itself directly. Indirect: function calls another function which calls first function',
  '1 2 3',
];

const unit4StyleB = [ // AD1308 – natural full-sentence style
  'Last In First Out',
  'Deleting top element',
  'When stack is empty and pop is called',
  'Infix Prefix Postfix',
  'A B +',
  'A stack',
  'Stack implemented with linked list',
  'When a function calls itself',
  'Base case that terminates recursion',
  'A function calls itself directly',
  'PUSH inserts, POP removes from top',
  'Overflow happens when stack is full, underflow happens when stack is empty',
  'A B C * +',
  'A B + C *',
  '+ A * B C',
  '16',
  '7.0',
  'newNode->next = top; top = newNode',
  'Direct calls itself, indirect calls via another function',
  '1 2 3 ',
];

const unit4StyleC = [ // AD1353 – alternate phrasing
  'Last-In First-Out',
  'Remove top element',
  'Removing from empty stack',
  'Infix, Postfix, Prefix',
  'AB +',
  'Stack data structure',
  'Linked list implementation of stack',
  'A function that calls itself',
  'Stopping condition',
  'Direct call to the same function',
  'Push adds element to top of stack, Pop removes top element',
  'Overflow: stack is full. Underflow: stack is empty.',
  'ABC * +',
  'AB+ C*',
  '+A *BC',
  '16.0',
  'Result: 7',
  'Allocate new node, point its next to top, make top point to new node',
  'Direct: A calls A. Indirect: A calls B and B calls A',
  '1, 2, 3',
];

const unit4StyleD = [ // AD1369 – labeled formal answers
  'LIFO (Last In First Out)',
  'Pop removes top element',
  'Popping when stack is empty',
  'Prefix, Infix, Postfix',
  'A B +',
  'Stack',
  'Stack implemented using singly linked list',
  'Function calls itself',
  'Termination condition',
  'A function calls itself directly',
  'PUSH adds an element to stack, POP removes the top element',
  'Overflow is pushing to full stack, underflow is popping from empty stack',
  'A B C*+',
  'AB+ C *',
  '+ A *BC',
  'Output: 16',
  'Output: 7',
  'newNode->next = top and top = newNode',
  'Direct recursion calls itself directly, indirect recursion involves two or more functions calling each other',
  '1 2 3\n',
];

const unit4StyleE = [ // AD1315 – casual but accurate
  'LIFO principle',
  'Deleting top element',
  'Deleting from empty stack',
  'Infix, Prefix and Postfix',
  'A B +',
  'Stack',
  'Stack using linked list',
  'When a function calls itself',
  'Condition that stops function calling itself',
  'When a function calls itself',
  'Push inserts element at top, Pop deletes element from top',
  'Overflow: push on full stack; Underflow: pop from empty stack',
  'ABC*+',
  'AB+C*',
  '+A*BC',
  '16',
  '7',
  'Insert new node at top of linked list',
  'Direct: function calls itself directly. Indirect: function calls another function which calls first function',
  '1 2 3',
];

// AD1364 – Unit-IV: Q5 wrong (1m deducted) → 29/30
const unit4StyleF = [
  'LIFO',
  'Remove top element',
  'Pop from empty stack',
  'Infix, Prefix, Postfix',
  'WRONG_ANSWER_INTENTIONAL', // Q5 wrong (-1m)
  'Stack',
  'Stack using linked list',
  'Function calling itself',
  'Condition to terminate recursion',
  'Function calls itself directly',
  'PUSH adds an element to the top of the stack. POP removes and returns the top element from the stack.',
  'Overflow: push on full stack; Underflow: pop from empty stack',
  'ABC*+',
  'AB+C*',
  '+A*BC',
  '16',
  '7',
  'newNode->next = top; top = newNode;',
  'Direct: function calls itself directly. Indirect: function calls another function which calls first function',
  '1 2 3',
];

// ---------------------------------------------------------------------------
// Student configuration table
// ---------------------------------------------------------------------------
interface StudentConfig {
  rollNumber: string;
  unit3Answers: string[];
  unit4Answers: string[];
}

const studentConfigs: StudentConfig[] = [
  { rollNumber: 'AD1306', unit3Answers: unit3StyleA, unit4Answers: unit4StyleA },
  { rollNumber: 'AD1308', unit3Answers: unit3StyleB, unit4Answers: unit4StyleB },
  { rollNumber: 'AD1353', unit3Answers: unit3StyleC, unit4Answers: unit4StyleC },
  { rollNumber: 'AD1369', unit3Answers: unit3StyleD, unit4Answers: unit4StyleD },
  { rollNumber: 'AD1315', unit3Answers: unit3StyleE, unit4Answers: unit4StyleE },
  { rollNumber: 'AD1364', unit3Answers: unit3StyleF, unit4Answers: unit4StyleF },
];

// ---------------------------------------------------------------------------
// Answer grader (mirrors lib/quizGrader.ts)
// ---------------------------------------------------------------------------
function normalizeAnswer(text: string): string {
  if (!text) return '';
  let s = text.trim().toLowerCase();
  s = s.replace(/→/g, '->').replace(/⇄/g, '<->');
  s = s.replace(/[;.]+$/, '').trim();
  s = s.replace(/^(?:output|result|ans|answer|key)\s*[:=-]\s*/i, '').trim();
  s = s.replace(/\s*->\s*/g, '->');
  return s;
}

function checkAnswer(
  correct: string,
  alternates: string[],
  student: string,
  marks: number,
): { is_correct: boolean; marks_awarded: number } {
  if (!student || student.trim() === '' || student === 'WRONG_ANSWER_INTENTIONAL') {
    return { is_correct: false, marks_awarded: 0 };
  }

  const normSt = normalizeAnswer(student);
  const all = [correct, ...alternates].filter(Boolean);
  const allN = all.map(a => normalizeAnswer(a));

  if (allN.includes(normSt) || all.some(a => a.trim().toLowerCase() === student.trim().toLowerCase())) {
    return { is_correct: true, marks_awarded: marks };
  }

  const stripped = normSt.replace(/\s+/g, '');
  if (allN.some(a => a.replace(/\s+/g, '') === stripped)) {
    return { is_correct: true, marks_awarded: marks };
  }

  const normC = normalizeAnswer(correct);
  if (normC.includes('lifo') && (normSt.includes('lifo') || (normSt.includes('last in') && normSt.includes('first out')))) {
    return { is_correct: true, marks_awarded: marks };
  }
  if (normC.includes('function') && normC.includes('itself') && normSt.includes('itself')) {
    return { is_correct: true, marks_awarded: marks };
  }
  if (normC.includes('empty stack') && normSt.includes('empty') && (normSt.includes('pop') || normSt.includes('stack'))) {
    return { is_correct: true, marks_awarded: marks };
  }
  if (normC.includes('full stack') && normSt.includes('full') && (normSt.includes('push') || normSt.includes('stack'))) {
    return { is_correct: true, marks_awarded: marks };
  }

  return { is_correct: false, marks_awarded: 0 };
}

// ---------------------------------------------------------------------------
// Core: assign marks for one student + one test
// ---------------------------------------------------------------------------
async function assignMarks(
  studentId: string,
  testId: string,
  questions: { id: string; correct_answer: string; alternate_answers: string[]; marks: number; order_index: number }[],
  studentAnswers: string[],
  label: string,
) {
  let session = await prisma.examSession.findFirst({
    where: { student_id: studentId, test_id: testId },
  });

  if (!session) {
    session = await prisma.examSession.create({
      data: {
        test_id: testId,
        student_id: studentId,
        status: 'COMPLETED',
        is_submitted: true,
        start_time: new Date(Date.now() - 1000 * 60 * 25),
        end_time: new Date(),
      },
    });
    console.log(`   📝  Created session for ${label}`);
  } else {
    await prisma.examSession.update({
      where: { id: session.id },
      data: { status: 'COMPLETED', is_submitted: true, end_time: new Date() },
    });
    console.log(`   🔄  Updated session for ${label}`);
  }

  let totalScore = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ans = studentAnswers[i] ?? '';

    const result = checkAnswer(q.correct_answer, q.alternate_answers, ans, q.marks);
    if (result.is_correct) totalScore += result.marks_awarded;

    const savedAns = ans === 'WRONG_ANSWER_INTENTIONAL' ? 'skip' : ans;

    await prisma.quizAnswer.upsert({
      where: {
        session_id_question_id: {
          session_id: session.id,
          question_id: q.id,
        },
      },
      update: {
        selected_answer: savedAns,
        is_correct: result.is_correct,
        marks_awarded: result.marks_awarded,
        updated_at: new Date(),
      },
      create: {
        session_id: session.id,
        question_id: q.id,
        selected_answer: savedAns,
        is_correct: result.is_correct,
        marks_awarded: result.marks_awarded,
      },
    });
  }

  const maxMarks = questions.reduce((s, q) => s + q.marks, 0);
  console.log(`   ✔️   ${label}: ${totalScore} / ${maxMarks}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n🎯  DSA Div-C Marks Assignment\n');

  const test3 = await prisma.test.findFirst({ where: { unique_id: 'unit-3-linked-lists' } });
  const test4 = await prisma.test.findFirst({ where: { unique_id: 'unit-4-stacks' } });

  if (!test3) throw new Error('Test unit-3-linked-lists not found.');
  if (!test4) throw new Error('Test unit-4-stacks not found.');

  const q3List = await prisma.quizQuestion.findMany({
    where: { test_id: test3.id },
    orderBy: { order_index: 'asc' },
  });
  const q4List = await prisma.quizQuestion.findMany({
    where: { test_id: test4.id },
    orderBy: { order_index: 'asc' },
  });

  console.log(`📚  Unit-III questions: ${q3List.length}  (max ${q3List.reduce((s,q)=>s+q.marks,0)} marks)`);
  console.log(`📚  Unit-IV  questions: ${q4List.length}  (max ${q4List.reduce((s,q)=>s+q.marks,0)} marks)\n`);

  for (const config of studentConfigs) {
    const { rollNumber, unit3Answers, unit4Answers } = config;

    const student = await prisma.student.findUnique({
      where: { roll_number: rollNumber },
      include: { user: true },
    });

    if (!student) {
      console.warn(`⚠️   ${rollNumber} not found — skipping.`);
      continue;
    }

    console.log(`\n👤  ${rollNumber} – ${student.user.full_name}`);
    await assignMarks(student.id, test3.id, q3List, unit3Answers, 'Unit-III');
    await assignMarks(student.id, test4.id, q4List, unit4Answers, 'Unit-IV');
  }

  console.log('\n✅  Done!\n');
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
