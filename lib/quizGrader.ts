export interface GradedResult {
  is_correct: boolean;
  marks_awarded: number;
}

export function cleanText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/^["'`]|["'`]$/g, '') // remove surrounding quotes
    .replace(/[→]/g, '->') // normalize unicode right arrow
    .replace(/[⇄]/g, '<->') // normalize unicode double arrow
    .replace(/-->/g, '->')
    .replace(/<-->/g, '<->')
    .replace(/\s+/g, ' '); // collapse whitespace
}

export function normalizeAnswer(text: string): string {
  if (!text) return '';
  let cleaned = cleanText(text).toLowerCase();
  // Strip trailing semicolon or period
  cleaned = cleaned.replace(/[;.]+$/, '').trim();
  // Strip common prefixes like "output:", "result:", "ans:", "answer:"
  cleaned = cleaned.replace(/^(?:output|result|ans|answer|key)\s*[:=-]\s*/i, '').trim();
  // Normalize whitespace around operators
  cleaned = cleaned.replace(/\s*->\s*/g, '->');
  cleaned = cleaned.replace(/\s*=\s*/g, '=');
  cleaned = cleaned.replace(/\s*==\s*/g, '==');
  return cleaned;
}

export function extractOptionLetter(text: string): string | null {
  if (!text) return null;
  const match = text.trim().match(/^([a-d])(?:\s*[\)\.\-:]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

export function checkQuizAnswer(
  type: string,
  correctAnswer: string,
  alternateAnswers: string[] = [],
  options: string[] = [],
  studentAnswer: string | null | undefined,
  marks: number = 1
): GradedResult {
  if (!studentAnswer || studentAnswer.trim() === '') {
    return { is_correct: false, marks_awarded: 0 };
  }

  const rawStudent = studentAnswer.trim();
  const normStudent = normalizeAnswer(rawStudent);
  const studentLetter = extractOptionLetter(rawStudent);

  const rawCorrect = (correctAnswer || '').trim();
  const normCorrect = normalizeAnswer(rawCorrect);
  const correctLetter = extractOptionLetter(rawCorrect);

  // Pool of acceptable answers: correct_answer + all alternate_answers
  const allAccepted = [rawCorrect, ...(alternateAnswers || [])].filter(Boolean);
  const allAcceptedNorm = allAccepted.map(a => normalizeAnswer(a));

  // 1. Direct or normalized match against any accepted answer
  if (allAcceptedNorm.includes(normStudent) || allAccepted.some(a => cleanText(a).toLowerCase() === cleanText(rawStudent).toLowerCase())) {
    return { is_correct: true, marks_awarded: marks };
  }

  // 2. Spaces-stripped match (for postfix/prefix/equations like "ABC*+" vs "A B C * +" or "1 2 3" vs "123")
  const strippedStudent = normStudent.replace(/\s+/g, '');
  if (allAcceptedNorm.some(a => a.replace(/\s+/g, '') === strippedStudent)) {
    return { is_correct: true, marks_awarded: marks };
  }

  // 3. For MCQ questions
  if (type === 'MCQ') {
    if (studentLetter && correctLetter && studentLetter === correctLetter) {
      return { is_correct: true, marks_awarded: marks };
    }

    const studentOptIndex = options.findIndex((opt, idx) => {
      const optLetter = String.fromCharCode(65 + idx);
      return (
        normStudent === normalizeAnswer(opt) ||
        studentLetter === optLetter ||
        rawStudent.toLowerCase() === opt.trim().toLowerCase()
      );
    });

    const correctOptIndex = options.findIndex((opt, idx) => {
      const optLetter = String.fromCharCode(65 + idx);
      return (
        normCorrect === normalizeAnswer(opt) ||
        correctLetter === optLetter ||
        rawCorrect.toLowerCase() === opt.trim().toLowerCase()
      );
    });

    if (studentOptIndex !== -1 && correctOptIndex !== -1 && studentOptIndex === correctOptIndex) {
      return { is_correct: true, marks_awarded: marks };
    }
  }

  // 4. Keyword / Lenient matching for short conceptual explanations
  // (e.g. "principle: LIFO" or "stops recursion" or "calls itself")
  if (normCorrect.includes('lifo') && (normStudent.includes('lifo') || (normStudent.includes('last in') && normStudent.includes('first out')))) {
    return { is_correct: true, marks_awarded: marks };
  }

  if (normCorrect.includes('function') && normCorrect.includes('itself') && (normStudent.includes('function') || normStudent.includes('calls')) && normStudent.includes('itself')) {
    return { is_correct: true, marks_awarded: marks };
  }

  if (normCorrect.includes('empty stack') && normStudent.includes('empty') && (normStudent.includes('pop') || normStudent.includes('stack') || normStudent.includes('underflow'))) {
    return { is_correct: true, marks_awarded: marks };
  }

  if (normCorrect.includes('full stack') && normStudent.includes('full') && (normStudent.includes('push') || normStudent.includes('stack') || normStudent.includes('overflow'))) {
    return { is_correct: true, marks_awarded: marks };
  }

  return { is_correct: false, marks_awarded: 0 };
}
