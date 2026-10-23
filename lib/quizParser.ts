export interface ParsedQuestion {
  type: 'MCQ' | 'FILL_BLANK' | 'ODD_ONE_OUT';
  question_text: string;
  options: string[];
  correct_answer: string;
  alternate_answers?: string[];
  explanation?: string;
  marks: number;
}

export function parseQuizText(text: string): ParsedQuestion[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/);
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  // Group by question blocks
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      continue;
    }

    // Check if line looks like start of a new question, e.g. "Q1.", "Q1:", "1.", "Question 1"
    const isNewQ = /^(?:Q\d+[\.:\s]|\d+[\.:\)]\s+|Question\s+\d+[\.:\s])/i.test(trimmed);
    if (isNewQ && currentBlock.length > 0) {
      // Check if current block already has an answer or options
      const hasAnswer = currentBlock.some(l => /^(?:Answer|Ans|Correct)[\s\-_:]/i.test(l));
      if (hasAnswer) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    }

    currentBlock.push(trimmed);
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const results: ParsedQuestion[] = [];

  for (const block of blocks) {
    if (block.length === 0) continue;

    let questionText = '';
    const options: string[] = [];
    let correctAnswer = '';
    let explanation = '';
    let qType: 'MCQ' | 'FILL_BLANK' | 'ODD_ONE_OUT' = 'MCQ';

    let readingQuestion = true;

    for (let i = 0; i < block.length; i++) {
      const line = block[i];

      // Check if line is an answer
      const ansMatch = line.match(/^(?:Answer|Ans|Correct|Key)[\s\-_:]+(.*)$/i);
      if (ansMatch) {
        readingQuestion = false;
        correctAnswer = ansMatch[1].trim();
        continue;
      }

      // Check if line is explanation
      const expMatch = line.match(/^(?:Explanation|Reason|Note)[\s\-_:]+(.*)$/i);
      if (expMatch) {
        readingQuestion = false;
        explanation = expMatch[1].trim();
        continue;
      }

      // Check if line is an option: "A) Frame buffer", "A. Frame buffer", "(A) ...", "A- ..."
      const optMatch = line.match(/^(?:[A-D]\s*[\)\.\-:]|\([A-D]\))\s*(.*)$/i);
      if (optMatch) {
        readingQuestion = false;
        options.push(optMatch[1].trim());
        continue;
      }

      if (readingQuestion) {
        // Strip leading Q1. / 1. if present
        const cleaned = line.replace(/^(?:Q\d+[\.:\s]+|\d+[\.:\)]\s+|Question\s+\d+[\.:\s]+)/i, '').trim();
        questionText = questionText ? `${questionText} ${cleaned}` : cleaned;
      }
    }

    if (!questionText) continue;

    // Detect question type
    if (/odd\s+one\s+out/i.test(questionText)) {
      qType = 'ODD_ONE_OUT';
    } else if (options.length === 0 || /_{2,}|\[blank\]|fill\s+in\s+the\s+blank/i.test(questionText)) {
      qType = 'FILL_BLANK';
    } else {
      qType = 'MCQ';
    }

    // Clean up correct answer if it's formatted like "B) Pixel" or "B"
    let cleanAnswer = correctAnswer;
    const letterMatch = correctAnswer.match(/^([A-D])\s*[\)\.\-:]\s*(.*)$/i);
    if (letterMatch && options.length > 0) {
      const letterIdx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
      const textFromLetter = options[letterIdx] || letterMatch[2].trim();
      // Store the option text or letter
      cleanAnswer = textFromLetter || letterMatch[1].toUpperCase();
    } else if (cleanAnswer.length === 1 && /^[A-D]$/i.test(cleanAnswer) && options.length > 0) {
      const letterIdx = cleanAnswer.toUpperCase().charCodeAt(0) - 65;
      if (options[letterIdx]) {
        cleanAnswer = options[letterIdx];
      }
    }

    results.push({
      type: qType,
      question_text: questionText,
      options,
      correct_answer: cleanAnswer || correctAnswer,
      explanation: explanation || undefined,
      marks: 1
    });
  }

  return results;
}
