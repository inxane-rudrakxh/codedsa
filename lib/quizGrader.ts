export interface GradedResult {
  is_correct: boolean;
  marks_awarded: number;
}

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/^[a-d]\s*[\)\.\-:]\s*/i, '') // strip leading "A) ", "B. ", "C- "
    .replace(/\s+/g, ' '); // collapse whitespace
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
  const normStudent = normalizeText(rawStudent);
  const studentLetter = extractOptionLetter(rawStudent);

  const rawCorrect = (correctAnswer || '').trim();
  const normCorrect = normalizeText(rawCorrect);
  const correctLetter = extractOptionLetter(rawCorrect);

  if (type === 'MCQ') {
    // 1. Direct normalized match
    if (normStudent === normCorrect) {
      return { is_correct: true, marks_awarded: marks };
    }

    // 2. Letter match (e.g. student chose "B", answer is "B) Pixel" or vice versa)
    if (studentLetter && correctLetter && studentLetter === correctLetter) {
      return { is_correct: true, marks_awarded: marks };
    }

    // 3. Option text match against options list
    // Find index of student selection
    const studentOptIndex = options.findIndex((opt, idx) => {
      const optLetter = String.fromCharCode(65 + idx); // A, B, C, D
      return (
        normStudent === normalizeText(opt) ||
        studentLetter === optLetter ||
        rawStudent === opt
      );
    });

    const correctOptIndex = options.findIndex((opt, idx) => {
      const optLetter = String.fromCharCode(65 + idx);
      return (
        normCorrect === normalizeText(opt) ||
        correctLetter === optLetter ||
        rawCorrect === opt
      );
    });

    if (studentOptIndex !== -1 && correctOptIndex !== -1 && studentOptIndex === correctOptIndex) {
      return { is_correct: true, marks_awarded: marks };
    }

    // 4. Check alternate answers
    for (const alt of alternateAnswers) {
      if (normStudent === normalizeText(alt)) {
        return { is_correct: true, marks_awarded: marks };
      }
    }

    return { is_correct: false, marks_awarded: 0 };
  }

  if (type === 'FILL_BLANK') {
    // Case-insensitive trimmed match
    if (normStudent === normCorrect) {
      return { is_correct: true, marks_awarded: marks };
    }

    // Check alternate answers
    for (const alt of alternateAnswers) {
      if (normStudent === normalizeText(alt)) {
        return { is_correct: true, marks_awarded: marks };
      }
    }

    // Also remove dashes and punctuation for lenient matching (e.g., "scan conversion" vs "scan-conversion")
    const strippedStudent = normStudent.replace(/[^a-z0-9]/g, '');
    const strippedCorrect = normCorrect.replace(/[^a-z0-9]/g, '');
    if (strippedStudent && strippedCorrect && strippedStudent === strippedCorrect) {
      return { is_correct: true, marks_awarded: marks };
    }

    return { is_correct: false, marks_awarded: 0 };
  }

  if (type === 'ODD_ONE_OUT') {
    // Match either the option text, letter, or direct value
    if (normStudent === normCorrect) {
      return { is_correct: true, marks_awarded: marks };
    }
    if (studentLetter && correctLetter && studentLetter === correctLetter) {
      return { is_correct: true, marks_awarded: marks };
    }

    const studentOptIndex = options.findIndex((opt, idx) => {
      const optLetter = String.fromCharCode(65 + idx);
      return normStudent === normalizeText(opt) || studentLetter === optLetter;
    });

    const correctOptIndex = options.findIndex((opt, idx) => {
      const optLetter = String.fromCharCode(65 + idx);
      return normCorrect === normalizeText(opt) || correctLetter === optLetter;
    });

    if (studentOptIndex !== -1 && correctOptIndex !== -1 && studentOptIndex === correctOptIndex) {
      return { is_correct: true, marks_awarded: marks };
    }

    return { is_correct: false, marks_awarded: 0 };
  }

  return { is_correct: false, marks_awarded: 0 };
}
