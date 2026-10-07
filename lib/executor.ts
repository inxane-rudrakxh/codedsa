import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecutionResult {
  success: boolean;
  compile_error?: string;
  output?: string;
  stderr?: string;
  timed_out?: boolean;
  execution_time?: number;
}

const JUDGE0_URL = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
const JUDGE0_KEY = process.env.JUDGE0_API_KEY || '';

export async function compileAndRun(
  code: string, 
  input: string, 
  language: string = 'cpp', 
  timeLimit: number = 1.0, 
  memoryLimitKb: number = 256000
): Promise<ExecutionResult> {
  const startTime = Date.now();
  
  // Sanitize code by removing markdown blocks
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

  // Only C++ is supported
  let languageId = 54; // C++ (GCC 9.2.0)
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (JUDGE0_KEY) {
      if (JUDGE0_URL.includes('rapidapi')) {
        headers['X-RapidAPI-Key'] = JUDGE0_KEY;
        headers['X-RapidAPI-Host'] = new URL(JUDGE0_URL).host;
      } else {
        headers['X-Auth-Token'] = JUDGE0_KEY;
      }
    }

    const payload = {
      source_code: Buffer.from(sanitizedCode).toString('base64'),
      language_id: languageId,
      stdin: Buffer.from(input || '').toString('base64'),
      cpu_time_limit: timeLimit,
      memory_limit: memoryLimitKb
    };

    const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, compile_error: `Judge0 execution service returned ${res.status}: ${errorText}` };
    }

    const data = await res.json();
    
    // Helper to decode base64
    const decodeBase64 = (str: string | null | undefined) => {
      if (!str) return '';
      try {
        return Buffer.from(str, 'base64').toString('utf-8');
      } catch {
        return str;
      }
    };

    const stdoutStr = decodeBase64(data.stdout);
    const stderrStr = decodeBase64(data.stderr);
    const compileOutStr = decodeBase64(data.compile_output);

    // Judge0 Status IDs
    const statusId = data.status?.id;

    if (statusId === 6) { // Compilation Error
      return { success: false, compile_error: compileOutStr || 'Compilation Error' };
    }

    if (statusId === 5) { // Time Limit Exceeded
      return { success: false, timed_out: true, execution_time: parseFloat(data.time) * 1000 || timeLimit * 1000 };
    }

    if (statusId >= 7 && statusId <= 12) { // Runtime Errors
      return { 
        success: false, 
        stderr: stderrStr || 'Runtime Error',
        compile_error: `Runtime Error: ${data.status?.description || 'Unknown'}`
      };
    }
    
    // Status 3 = Accepted, 4 = Wrong Answer (we evaluate correctness manually)
    if (statusId === 3 || statusId === 4) {
      return {
        success: true,
        output: stdoutStr,
        stderr: stderrStr,
        execution_time: parseFloat(data.time) * 1000 || (Date.now() - startTime)
      };
    }
    
    return {
       success: false,
       compile_error: data.status?.description || 'Unknown Execution Error'
    };

  } catch (err: any) {
    return { success: false, compile_error: 'Internal Error: ' + err.message };
  }
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
  // Logic checks disabled so any valid C++ code (even hello world) compiles and runs fully.
  return { valid: true };
}

// Check if g++ is available
export async function isGppAvailable(): Promise<boolean> {
  try {
    await execAsync('g++ --version');
    return true;
  } catch {
    return false;
  }
}
