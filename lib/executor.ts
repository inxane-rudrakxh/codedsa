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

export async function compileAndRun(code: string, input: string): Promise<ExecutionResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codedsa-'));
  const srcFile = path.join(tmpDir, 'main.cpp');
  const binFile = path.join(tmpDir, 'main');
  const inputFile = path.join(tmpDir, 'input.txt');

  try {
    // Write source and input
    await fs.writeFile(srcFile, code, 'utf8');
    await fs.writeFile(inputFile, input, 'utf8');

    // Compile
    try {
      await execAsync(`g++ -std=c++17 -O2 -o "${binFile}" "${srcFile}" 2>&1`, {
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
      });
    } catch (err: unknown) {
      const error = err as { stdout?: string; message?: string };
      return {
        success: false,
        compile_error: (error.stdout || error.message || 'Compilation failed').trim(),
      };
    }

    // Execute
    const startTime = Date.now();
    try {
      const { stdout } = await execAsync(
        `"${binFile}" < "${inputFile}" 2>&1`,
        {
          timeout: EXEC_TIMEOUT_MS,
          maxBuffer: MAX_OUTPUT_BYTES,
        }
      );
      const executionTime = Date.now() - startTime;
      return {
        success: true,
        output: stdout.trim(),
        execution_time: executionTime,
      };
    } catch (err: unknown) {
      const error = err as { killed?: boolean; stdout?: string; stderr?: string; message?: string };
      if (error.killed) {
        return {
          success: false,
          timed_out: true,
          compile_error: 'Time Limit Exceeded (2 seconds)',
          output: '',
        };
      }
      return {
        success: true,
        output: (error.stdout || '').trim(),
        stderr: (error.stderr || error.message || '').trim(),
        execution_time: Date.now() - startTime,
      };
    }
  } finally {
    // Cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
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

  // Fallback 2: Token sequence matching
  // This allows students to print arbitrary prompts like "Enter array: " before the output
  const actualTokens = normActual.split(/\s+/).filter(Boolean);
  const expectedTokens = normExpected.split(/\s+/).filter(Boolean);

  if (expectedTokens.length === 0) return false;

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

  // Fallback 3: Numeric-only subsequence matching (for when words are mixed in)
  const isNumeric = (str: string) => /^-?\d+(\.\d+)?$/.test(str);
  if (expectedTokens.every(isNumeric)) {
    const actualNums = actualTokens.filter(isNumeric);
    for (let i = 0; i <= actualNums.length - expectedTokens.length; i++) {
      let match = true;
      for (let j = 0; j < expectedTokens.length; j++) {
        // Compare mathematically if possible to handle 2.80 vs 2.8
        if (parseFloat(actualNums[i + j]) !== parseFloat(expectedTokens[j])) {
          match = false;
          break;
        }
      }
      if (match) return true;
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
