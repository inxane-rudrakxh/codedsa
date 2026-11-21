import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const inheritanceQuestions = [
  ['Which class is inherited by another class in C++?', ['Derived class', 'Base class', 'Sub class', 'Child class'], 'Base class', 'The base class is the parent class from which properties are inherited.'],
  ['Which access specifier allows a member to be accessed in the base class and its derived classes, but not outside the class?', ['public', 'private', 'protected', 'global'], 'protected', 'Protected members are accessible inside the base class and derived classes, but not from outside.'],
  ['In single inheritance, which constructor is executed first when an object of a derived class is created?', ['Derived class constructor', 'Base class constructor', 'Destructor', 'Both constructors simultaneously'], 'Base class constructor', 'The base class constructor runs before the derived class constructor.'],
  ['Which keyword is used in a base class function to allow runtime overriding in a derived class?', ['static', 'inline', 'virtual', 'friend'], 'virtual', 'The virtual keyword enables dynamic dispatch and runtime overriding.'],
  ['When one derived class inherits from a single base class, what type of inheritance is it?', ['Multiple inheritance', 'Single inheritance', 'Hierarchical inheritance', 'Multilevel inheritance'], 'Single inheritance', 'Single inheritance has one base class and one derived class.'],
  ['What is it called when one derived class inherits directly from more than one base class?', ['Single inheritance', 'Multiple inheritance', 'Multilevel inheritance', 'Hybrid inheritance'], 'Multiple inheritance', 'Multiple inheritance occurs when a derived class inherits from two or more base classes.'],
  ['Why is a virtual base class used in C++?', ['To speed up program execution', 'To avoid multiple copies of a base class in diamond inheritance', 'To make all member variables static', 'To prevent inheritance completely'], 'To avoid multiple copies of a base class in diamond inheritance', 'Virtual base classes resolve duplicate base-class subobjects in diamond-shaped inheritance.'],
  ['What makes a class an abstract class in C++?', ['It has no member variables', 'It contains at least one pure virtual function (= 0)', 'It has no main function', 'It cannot have derived classes'], 'It contains at least one pure virtual function (= 0)', 'A pure virtual function makes the class abstract and prevents direct instantiation.'],
  ['A friend class can access which members of the class that declares it as a friend?', ['Public members only', 'Private and protected members as well as public members', 'Protected members only', 'Cannot access any private members'], 'Private and protected members as well as public members', 'A friend class can access private, protected, and public members.'],
  ['What is a nested class in C++?', ['A class defined inside another class', 'A class inherited from two base classes', 'A class with only static methods', 'A class without constructors'], 'A class defined inside another class', 'A nested class is declared within the scope of an enclosing class.'],
] as const;

const polymorphismQuestions = [
  ['What does the term polymorphism literally mean in object-oriented programming?', ['Single form', 'Many forms', 'No forms', 'Hidden data'], 'Many forms', 'Polymorphism comes from Greek words meaning “many forms.”'],
  ['Which is an example of compile-time polymorphism in C++?', ['Virtual functions', 'Function overloading', 'Pointers to base class', 'Abstract base classes'], 'Function overloading', 'Function overloading is resolved during compilation.'],
  ['Which C++ keyword is used to overload an operator?', ['overload', 'operator', 'virtual', 'friend'], 'operator', 'The operator keyword followed by a symbol defines an overloaded operator function.'],
  ['How many operands does a unary operator such as ++ or -- operate on?', ['One', 'Two', 'Three', 'Zero'], 'One', 'A unary operator operates on one operand.'],
  ['Function overloading allows functions in the same scope to share a name if they differ in what?', ['Return type only', 'Function body only', 'Number or types of parameters', 'Class access specifier'], 'Number or types of parameters', 'Overloaded functions must have distinct parameter lists; return type alone is not enough.'],
  ['Which keyword is placed before a base-class member function to achieve runtime polymorphism?', ['static', 'inline', 'virtual', 'override'], 'virtual', 'The virtual keyword enables dynamic dispatch at runtime.'],
  ['How is a pure virtual function declared in a C++ base class?', ['virtual void show() = 0;', 'pure void show();', 'virtual void show() = 1;', 'void show() = NULL;'], 'virtual void show() = 0;', 'A pure virtual function is declared with = 0.'],
  ['What is the primary role of the virtual table (vtable)?', ['To store object data members', 'To resolve virtual function calls dynamically at runtime', 'To overload binary operators', 'To compile code faster'], 'To resolve virtual function calls dynamically at runtime', 'The vtable supports dynamic binding of virtual function calls.'],
  ['Why should a base-class destructor be virtual when derived objects are deleted through base pointers?', ['To prevent object creation', 'To ensure derived-class destruction runs correctly', 'To speed up execution', 'To make the base class abstract'], 'To ensure derived-class destruction runs correctly', 'A virtual destructor ensures the derived destructor is called through a base pointer.'],
  ['What happens if you try to create a direct object of an abstract base class?', ['An object is created successfully', 'A compile-time error occurs', 'A runtime error occurs', 'The program produces garbage output'], 'A compile-time error occurs', 'Abstract classes cannot be instantiated directly.'],
] as const;

async function main() {
  const subject = await prisma.subject.upsert({
    where: { code: 'OOP_CPP' },
    update: { name: 'Object-Oriented Programming in C++' },
    create: { code: 'OOP_CPP', name: 'Object-Oriented Programming in C++' },
  });
  const admin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'TEACHER'] } }, orderBy: { created_at: 'asc' } });
  const teacherId = admin?.id ?? null;

  const sets = [
    { bankName: 'OOP in C++ – Inheritance (Puzzle)', uniqueId: 'oop-cpp-inheritance-puzzle', title: 'OOP in C++ – Inheritance Puzzle Test', category: 'PUZZLE', testType: 'PUZZLE', questions: inheritanceQuestions },
    { bankName: 'OOP in C++ – Polymorphism (Quiz)', uniqueId: 'oop-cpp-polymorphism-quiz', title: 'OOP in C++ – Polymorphism Quiz', category: 'QUIZ', testType: 'QUIZ', questions: polymorphismQuestions },
  ] as const;

  for (const set of sets) {
    const bank = await prisma.questionBank.upsert({
      where: { name: set.bankName },
      update: { description: `10 easy-level MCQs on ${set.category === 'PUZZLE' ? 'inheritance' : 'polymorphism'} in C++.`, category: set.category, subject_code: subject.code, total_marks: 10, duration_minutes: 15 },
      create: { name: set.bankName, description: `10 easy-level MCQs on ${set.category === 'PUZZLE' ? 'inheritance' : 'polymorphism'} in C++.`, category: set.category, subject_code: subject.code, total_marks: 10, duration_minutes: 15 },
    });
    const existing = await prisma.test.findUnique({ where: { unique_id: set.uniqueId } });
    const testData = {
      title: set.title,
      description: `Easy-level C++ OOP assessment covering ${set.category === 'PUZZLE' ? 'inheritance' : 'polymorphism'}.`,
      instructions: 'Answer all 10 questions. Each question carries 1 mark. Duration: 15 minutes.',
      subject_id: subject.id,
      teacher_id: teacherId,
      duration_minutes: 15,
      total_marks: 10,
      questions_per_student: 10,
      test_type: set.testType,
      auto_approve: true,
      marks_published: true,
      randomize_questions: false,
      status: 'PUBLISHED',
    };
    const test = existing
      ? await prisma.test.update({ where: { id: existing.id }, data: testData })
      : await prisma.test.create({ data: { ...testData, unique_id: set.uniqueId } });

    await prisma.quizAnswer.deleteMany({ where: { question: { test_id: test.id } } });
    await prisma.quizQuestion.deleteMany({ where: { test_id: test.id } });
    for (const [index, [question, options, answer, explanation]] of set.questions.entries()) {
      await prisma.quizQuestion.create({
        data: {
          test_id: test.id,
          bank_id: bank.id,
          bank_name: bank.name,
          type: 'MCQ',
          question_text: question,
          options: [...options],
          correct_answer: answer,
          explanation,
          marks: 1,
          order_index: index + 1,
        },
      });
    }
    console.log(`Published ${set.title} (${set.questions.length} questions; id ${test.unique_id}).`);
  }
}

main().catch(error => {
  console.error('OOP C++ test seeding failed:', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
