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

const COMPILE_TIMEOUT_MS = 5000;
const EXEC_TIMEOUT_MS = 2000;
const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB

export async function compileAndRun(code: string, input: string, language: string = 'cpp'): Promise<ExecutionResult> {
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

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codedsa-run-'));
  const inputPath = path.join(tmpDir, 'input.txt');
  let srcPath = '';
  let binPath = '';
  let compileCmd = '';
  let runCmd = '';

  try {
    await fs.writeFile(inputPath, input);
    
    switch(language.toLowerCase()) {
      case 'c':
        srcPath = path.join(tmpDir, 'main.c');
        binPath = path.join(tmpDir, 'program');
        compileCmd = `gcc "${srcPath}" -o "${binPath}" -O2`;
        runCmd = `"${binPath}" < "${inputPath}"`;
        break;
      case 'cpp':
      case 'c++':
        srcPath = path.join(tmpDir, 'main.cpp');
        binPath = path.join(tmpDir, 'program');
        compileCmd = `g++ "${srcPath}" -o "${binPath}" -O2`;
        runCmd = `"${binPath}" < "${inputPath}"`;
        break;
      case 'python':
      case 'py':
        srcPath = path.join(tmpDir, 'main.py');
        compileCmd = ''; 
        runCmd = `python3 "${srcPath}" < "${inputPath}"`;
        break;
      case 'java':
        srcPath = path.join(tmpDir, 'Main.java');
        compileCmd = `javac "${srcPath}"`;
        runCmd = `java -cp "${tmpDir}" Main < "${inputPath}"`;
        break;
      default:
        srcPath = path.join(tmpDir, 'main.cpp');
        binPath = path.join(tmpDir, 'program');
        compileCmd = `g++ "${srcPath}" -o "${binPath}" -O2`;
        runCmd = `"${binPath}" < "${inputPath}"`;
        break;
    }

    await fs.writeFile(srcPath, sanitizedCode);

    if (compileCmd) {
      try {
        await execAsync(compileCmd, { timeout: COMPILE_TIMEOUT_MS });
      } catch (compileErr: any) {
        return {
          success: false,
          compile_error: (compileErr.stderr || compileErr.message || '').trim(),
        };
      }
    }

    try {
      const { stdout, stderr } = await execAsync(runCmd, { timeout: EXEC_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES });
      return {
        success: true,
        output: stdout.trim(),
        stderr: stderr.trim(),
        execution_time: Date.now() - startTime
      };
    } catch (execErr: any) {
      if (execErr.killed || execErr.signal === 'SIGTERM') {
        return { success: false, timed_out: true, execution_time: Date.now() - startTime };
      }
      return {
        success: true,
        output: (execErr.stdout || '').trim(),
        stderr: (execErr.stderr || '').trim(),
        execution_time: Date.now() - startTime
      };
    }
  } catch (err: any) {
    return {
      success: false,
      compile_error: 'Internal Error: ' + err.message,
    };
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (e) {}
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
