export interface ExecutionResult {
  success: boolean;
  compile_error?: string;
  runtime_error?: string;
  output?: string;
  stderr?: string;
  timed_out?: boolean;
  execution_time?: number;
}

const ONLINECOMPILER_API_KEY = process.env.ONLINECOMPILER_API_KEY || '02bd1337680993207d62a9fee6231dbc';
const ONLINECOMPILER_API_URL = process.env.ONLINECOMPILER_API_URL || 'https://api.onlinecompiler.io/api/run-code-sync/';

// Language mapping to onlinecompiler.io compiler IDs
const COMPILER_MAP: Record<string, string> = {
  cpp: 'g++-15',
  'c++': 'g++-15',
  c: 'gcc-15',
  python: 'python-3.14',
  py: 'python-3.14',
  java: 'openjdk-25',
  csharp: 'dotnet-csharp-10',
  cs: 'dotnet-csharp-10',
  javascript: 'nodejs-24',
  js: 'nodejs-24',
  typescript: 'typescript-deno',
  ts: 'typescript-deno',
  go: 'go-1.26',
  rust: 'rust-1.93',
};

// Concurrency limiter to strictly respect 2 concurrent runs at once
class ConcurrencyLimiter {
  private current = 0;
  private queue: Array<() => void> = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(): Promise<() => void> {
    if (this.current < this.maxConcurrent) {
      this.current++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.current--;
        const next = this.queue.shift();
        if (next) {
          this.current++;
          next();
        }
      };
    }

    return new Promise(resolve => {
      this.queue.push(() => {
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.current--;
          const next = this.queue.shift();
          if (next) {
            this.current++;
            next();
          }
        });
      });
    });
  }
}

// Global concurrency limiter for 2 runs at once across the server
const executionLimiter = new ConcurrencyLimiter(2);

export function detectEffectiveLanguage(code: string, requestedLang: string): string {
  const norm = (requestedLang || 'cpp').toLowerCase();
  if (norm === 'c') {
    const hasCpp = /#include\s*<iostream>|#include\s*<vector>|#include\s*<string>|#include\s*<algorithm>|#include\s*<map>|#include\s*<set>|#include\s*<queue>|#include\s*<stack>|#include\s*<bits\/stdc\+\+\.h>|using\s+namespace\s+std|\bstd::|\bcout\b|\bcin\b|\bendl\b|\bclass\s+\w+|\btemplate\s*<|\bnew\s+\w+|\bdelete\s+\w+/.test(code);
    if (hasCpp) return 'cpp';
  }
  return norm;
}

export async function compileAndRun(
  code: string,
  input: string = '',
  language: string = 'cpp',
  timeLimit: number = 5.0,
  _memoryLimitKb?: number
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Sanitize code by removing markdown blocks if present
  let sanitizedCode = code.trim();
  if (sanitizedCode.startsWith('```')) {
    const firstNewline = sanitizedCode.indexOf('\n');
    if (firstNewline !== -1) {
      sanitizedCode = sanitizedCode.substring(firstNewline + 1);
    }
    if (sanitizedCode.endsWith('```')) {
      sanitizedCode = sanitizedCode.substring(0, sanitizedCode.length - 3).trim();
    }
  }

  const langLower = (language || 'cpp').toLowerCase();
  const effectiveLang = detectEffectiveLanguage(sanitizedCode, langLower);
  const compiler = COMPILER_MAP[effectiveLang] || COMPILER_MAP[langLower] || 'g++-15';

  const safeTimeLimit = Math.min(Math.max(Math.round(timeLimit || 5), 1), 30);

  const release = await executionLimiter.acquire();
  try {
    let attempts = 0;
    while (attempts < 2) {
      attempts++;
      try {
        const response = await fetch(ONLINECOMPILER_API_URL, {
          method: 'POST',
          headers: {
            Authorization: ONLINECOMPILER_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            compiler,
            code: sanitizedCode,
            input: input || '',
            time_limit: safeTimeLimit,
          }),
        });

        if (response.status === 429 && attempts < 2) {
          // Rate limit backoff (30 submissions a minute limit)
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          return {
            success: false,
            runtime_error: `Compiler API error (${response.status}): ${errText || response.statusText}`,
            execution_time: Date.now() - startTime,
          };
        }

        const data: {
          output?: string;
          error?: string;
          status?: string;
          exit_code?: number;
          time?: string;
          total?: string;
          memory?: string;
        } = await response.json();

        const execDuration = Math.round(
          (parseFloat(data.time || '') || parseFloat(data.total || '') || (Date.now() - startTime) / 1000) * 1000
        );

        const formattedOutput = formatInteractiveOutput(data.output || '', input || '');

        // Check for Time Limit Exceeded (exit_code 124 or error with timeout)
        if (data.exit_code === 124 || (data.status === 'error' && !data.error && execDuration >= safeTimeLimit * 1000 * 0.9)) {
          return {
            success: false,
            timed_out: true,
            runtime_error: `Time Limit Exceeded (${safeTimeLimit}s)`,
            output: formattedOutput,
            execution_time: execDuration,
          };
        }

        // Check for error
        if (data.status === 'error' || (data.exit_code !== 0 && data.exit_code !== undefined)) {
          const errMsg = data.error || '';
          const isCompileError =
            (effectiveLang === 'cpp' || effectiveLang === 'c' || effectiveLang === 'java') &&
            (/error:|fatal error:|undeclared|syntax error|cannot find symbol/i.test(errMsg) || !data.output);

          if (isCompileError) {
            return {
              success: false,
              compile_error: errMsg || 'Compilation Error',
              output: formattedOutput,
              execution_time: execDuration,
            };
          }

          return {
            success: false,
            runtime_error: errMsg || `Process exited with code ${data.exit_code}`,
            output: formattedOutput,
            stderr: errMsg,
            execution_time: execDuration,
          };
        }

        return {
          success: true,
          output: formattedOutput,
          stderr: data.error || '',
          execution_time: execDuration,
        };
      } catch (networkErr: any) {
        if (attempts < 2) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        return {
          success: false,
          runtime_error: `Network error reaching compiler: ${networkErr.message || 'Connection failed'}`,
          execution_time: Date.now() - startTime,
        };
      }
    }

    return {
      success: false,
      runtime_error: 'Failed to execute code. Please retry.',
      execution_time: Date.now() - startTime,
    };
  } finally {
    release();
  }
}

/**
 * Formats interactive program outputs where prompts may be concatenated without
 * newlines (e.g. "Enter your name:Enter your age:") and interleaves provided stdin
 * tokens next to their respective prompt lines.
 */
export function formatInteractiveOutput(output: string, input: string = ''): string {
  if (!output) return output;
  let text = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const promptKeywords = 'enter|input|give|insert|type|choose|select|specify|provide|read|what|how';
  // Separate prompts glued together without newlines (e.g. "Enter your name:Enter your age:" or "Enter your age:Hello")
  text = text.replace(new RegExp(`(\\b(?:${promptKeywords})\\b[^:\\n\\r\\t]*[:?])\\s*(?=[A-Z])`, 'gi'), '$1\n');
  text = text.replace(/([a-zA-Z0-9_][?:]|[>])\s*(?=[A-Z][a-zA-Z0-9_ ]*[:?>])/g, '$1\n');

  if (input && input.trim()) {
    const inputTokens = input.trim().split(/\s+/).filter(Boolean);
    const promptWordRegex = new RegExp(`\\b(?:${promptKeywords})\\b`, 'i');

    const lines = text.split('\n');
    const promptIndices: number[] = [];
    lines.forEach((line, idx) => {
      const match = line.match(/^([^:\n\r\t]+[:?>])(\s*|$)/);
      if (match && (promptWordRegex.test(match[1]) || /[:?>]\s*$/.test(line))) {
        promptIndices.push(idx);
      }
    });

    if (promptIndices.length > 0) {
      let tokenIdx = 0;
      const formatted = lines.map((line, idx) => {
        if (!promptIndices.includes(idx)) return line;

        const purePrompt = line.match(/^([^:\n\r\t]+[:?>])\s*$/);
        const promptWithTrailing = line.match(/^([^:\n\r\t]+[:?>])\s*([A-Za-z0-9].*)$/);
        const isPrompt = purePrompt || promptWithTrailing;
        if (!isPrompt) return line;

        const promptPart = isPrompt[1];
        const trailingPart = promptWithTrailing ? promptWithTrailing[2] : '';

        const currentPromptPos = promptIndices.indexOf(idx);
        const isLastPrompt = currentPromptPos === promptIndices.length - 1;
        let tokensForThisPrompt: string[] = [];

        if (isLastPrompt) {
          tokensForThisPrompt = inputTokens.slice(tokenIdx);
          tokenIdx = inputTokens.length;
        } else {
          const remainingPrompts = promptIndices.length - currentPromptPos - 1;
          const remainingTokens = inputTokens.length - tokenIdx;
          const takeCount = Math.max(1, remainingTokens - remainingPrompts);
          tokensForThisPrompt = inputTokens.slice(tokenIdx, tokenIdx + takeCount);
          tokenIdx += takeCount;
        }

        const joinedTokens = tokensForThisPrompt.join(' ');
        const lineResult = joinedTokens ? `${promptPart} ${joinedTokens}` : promptPart;
        return trailingPart ? `${lineResult}\n${trailingPart}` : lineResult;
      });

      text = formatted.join('\n');
    }
  }

  return text;
}

export function normalizeOutput(output: string): string {
  return output
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Compares student program output against expected test case output.
 * 
 * DESIGN RATIONALE / GRADING POLICY (DSA Examination Portal):
 * Student solutions often include conversational I/O prompts (e.g. "Enter N: ",
 * "Array elements are:", "Result = 42") that would fail strict byte-for-byte diffs.
 * To ensure fairness in university examination environments, a 4-tier comparison is used:
 *   1. Exact normalized match: whitespace/newlines trimmed and normalized.
 *   2. Substring match: expected output is fully contained within the actual output.
 *   3. Token sequence match: punctuation/casing stripped; token order must match.
 *   4. Subsequence / numeric match: numeric answers or key tokens appear in expected order.
 */
export function compareOutputs(actual: string, expected: string): boolean {
  const normActual = normalizeOutput(actual);
  const normExpected = normalizeOutput(expected);
  
  if (normActual === normExpected) return true;

  // Fallback 1: Substring match (ignoring exact formatting)
  if (normActual.includes(normExpected)) return true;

  // Helper to extract only alphanumeric words
  const extractAlphanumeric = (str: string) => 
    str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

  const actualTokens = extractAlphanumeric(normActual);
  const expectedTokens = extractAlphanumeric(normExpected);

  if (expectedTokens.length === 0) return false;

  // Fallback 2: Token sequence matching (ignoring punctuation and case)
  for (let i = 0; i <= actualTokens.length - expectedTokens.length; i++) {
    let match = true;
    for (let j = 0; j < expectedTokens.length; j++) {
      if (actualTokens[i + j] !== expectedTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  // Fallback 3: Subsequence matching (allows extra words in between)
  // e.g., Expected: "found 5", Actual: "element is found at position 5"
  let expectedIndex = 0;
  for (let i = 0; i < actualTokens.length; i++) {
    if (actualTokens[i] === expectedTokens[expectedIndex]) {
      expectedIndex++;
      if (expectedIndex === expectedTokens.length) {
        return true; // All expected tokens found in order
      }
    }
  }

  // Fallback 4: Numeric-only subsequence matching (for when words are completely different but math is right)
  const isNumeric = (str: string) => /^-?\d+(\.\d+)?$/.test(str);
  const expectedNums = expectedTokens.filter(isNumeric);
  
  if (expectedNums.length > 0) {
    const actualNums = actualTokens.filter(isNumeric);
    let numIndex = 0;
    for (let i = 0; i < actualNums.length; i++) {
      if (parseFloat(actualNums[i]) === parseFloat(expectedNums[numIndex])) {
        numIndex++;
        if (numIndex === expectedNums.length) {
          return true;
        }
      }
    }
  }

  return false;
}

export function checkCodeLogic(code: string, questionId: number): { valid: boolean; reason?: string } {
  return { valid: true };
}
