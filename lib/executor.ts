import { exec, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecutionResult {
  success: boolean;
  compile_error?: string;
  runtime_error?: string;
  output?: string;
  stderr?: string;
  timed_out?: boolean;
  execution_time?: number;
}

const JUDGE0_URL = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
const JUDGE0_KEY = process.env.JUDGE0_API_KEY || '';

export function detectEffectiveLanguage(code: string, requestedLang: string): string {
  const norm = (requestedLang || 'cpp').toLowerCase();
  if (norm === 'c') {
    const hasCpp = /#include\s*<iostream>|#include\s*<vector>|#include\s*<string>|#include\s*<algorithm>|#include\s*<map>|#include\s*<set>|#include\s*<queue>|#include\s*<stack>|#include\s*<bits\/stdc\+\+\.h>|using\s+namespace\s+std|std::|cout\s*<<|cin\s*>>|\bclass\s+\w+|\btemplate\s*<|\bnew\s+\w+|\bdelete\s+\w+/.test(code);
    if (hasCpp) return 'cpp';
  }
  return norm;
}

async function runLocalCode(
  code: string,
  input: string,
  lang: string,
  timeLimitSec: number
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const runId = crypto.randomBytes(8).toString('hex');
  const tempDir = path.join(os.tmpdir(), `exec_${runId}`);
  await fs.mkdir(tempDir, { recursive: true });

  const effectiveLang = detectEffectiveLanguage(code, lang);

  try {
    let srcFile = '';
    let exeFile = '';
    let compileCmd: string | null = null;
    let runCmd = '';
    let runArgs: string[] = [];

    if (effectiveLang === 'c') {
      srcFile = path.join(tempDir, 'main.c');
      exeFile = path.join(tempDir, 'a.out');
      compileCmd = `gcc -std=c11 -O2 "${srcFile}" -o "${exeFile}" -lm`;
      runCmd = exeFile;
    } else if (effectiveLang === 'cpp') {
      srcFile = path.join(tempDir, 'main.cpp');
      exeFile = path.join(tempDir, 'a.out');
      compileCmd = `g++ -std=c++17 -O2 "${srcFile}" -o "${exeFile}"`;
      runCmd = exeFile;
    } else if (effectiveLang === 'python') {
      srcFile = path.join(tempDir, 'main.py');
      runCmd = 'python3';
      runArgs = [srcFile];
    } else {
      throw new Error(`Unsupported local language: ${effectiveLang}`);
    }

    await fs.writeFile(srcFile, code);

    // Whitelist isolated environment variables to prevent leaking server secrets (DATABASE_URL, JWT_SECRET, etc.)
    const safeEnv: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      HOME: tempDir,
      TMPDIR: tempDir,
    };

    // 1. Compile step (if required)
    if (compileCmd) {
      try {
        await execAsync(compileCmd, { cwd: tempDir, env: safeEnv, timeout: 10000 });
      } catch (err: any) {
        // If C compilation failed, attempt C++ compilation fallback with g++
        if (effectiveLang === 'c') {
          const cppFile = path.join(tempDir, 'main.cpp');
          try {
            await fs.copyFile(srcFile, cppFile);
            await execAsync(`g++ -std=c++17 -O2 "${cppFile}" -o "${exeFile}"`, { cwd: tempDir, env: safeEnv, timeout: 10000 });
            // Successfully compiled via g++ fallback!
          } catch {
            return {
              success: false,
              compile_error: (err.stderr || err.stdout || err.message || 'Compilation Error').trim(),
              execution_time: Date.now() - startTime
            };
          }
        } else {
          return {
            success: false,
            compile_error: (err.stderr || err.stdout || err.message || 'Compilation Error').trim(),
            execution_time: Date.now() - startTime
          };
        }
      }
    }

    // 2. Execution step with piped stdin and timeout
    return await new Promise<ExecutionResult>((resolve) => {
      const child = spawn(runCmd, runArgs, {
        cwd: tempDir,
        env: safeEnv,
        timeout: Math.max(timeLimitSec * 1000, 2000)
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, Math.max(timeLimitSec * 1000, 2000));

      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          runtime_error: err.message,
          execution_time: Date.now() - startTime
        });
      });

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        if (timedOut || signal === 'SIGKILL' || signal === 'SIGTERM') {
          resolve({
            success: false,
            timed_out: true,
            execution_time: duration
          });
        } else if (code !== 0) {
          resolve({
            success: false,
            output: stdout,
            stderr: stderr,
            runtime_error: stderr.trim() || `Process exited with code ${code}`,
            execution_time: duration
          });
        } else {
          resolve({
            success: true,
            output: stdout,
            stderr: stderr,
            execution_time: duration
          });
        }
      });

      if (input) {
        child.stdin.write(input);
      }
      child.stdin.end();
    });

  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

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

  const langLower = language.toLowerCase();
  const effectiveLang = detectEffectiveLanguage(sanitizedCode, langLower);

  // Try fast local compilation first for C, C++, and Python
  if (effectiveLang === 'c' || effectiveLang === 'cpp' || effectiveLang === 'python') {
    try {
      return await runLocalCode(sanitizedCode, input, effectiveLang, timeLimit);
    } catch (localErr) {
      console.warn("Local execution failed, falling back to Judge0:", localErr);
    }
  }

  let languageId = 54; // C++ (GCC 9.2.0)
  if (effectiveLang === 'c') languageId = 50;
  else if (effectiveLang === 'python') languageId = 71;
  else if (effectiveLang === 'java') languageId = 62;
  
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
        runtime_error: `Runtime Error: ${data.status?.description || 'Unknown'}`
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
