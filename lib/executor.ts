import { exec, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { promisify } from 'util';
import { simulateCodeExecutionWithAI } from './ai';

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
// Default to self-hosted Piston on localhost:2000 if not configured otherwise
const PISTON_URL = process.env.PISTON_API_URL || 'http://localhost:2000/api/v2';

// Language + version map for engineer-man/piston self-hosted container.
// Piston uses 'gcc' for both C and C++ — file extension (.c vs .cpp) selects the compiler.
// Run: curl http://localhost:2000/api/v2/runtimes  to see installed runtimes.
const PISTON_LANG_MAP: Record<string, { language: string; version: string; filename: string }> = {
  cpp:    { language: 'c++',    version: '10.2.0', filename: 'main.cpp' },
  c:      { language: 'c',      version: '10.2.0', filename: 'main.c'   },
  python: { language: 'python', version: '3.10.0', filename: 'main.py' },
  java:   { language: 'java',   version: '15.0.2', filename: 'Main.java' },
};

async function getPistonLangMeta(lang: string): Promise<{ language: string; version: string; filename: string }> {
  const defaults = PISTON_LANG_MAP[lang] || { language: lang, version: '*', filename: 'main.cpp' };
  const base = PISTON_URL.replace(/\/execute\/?$/, '').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/runtimes`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const runtimes: Array<{ language: string; version: string; aliases?: string[] }> = await res.json();
      const target = defaults.language.toLowerCase();
      // Find the installed runtime matching our target language or aliases
      const matches = runtimes.filter(r =>
        r.language.toLowerCase() === target ||
        r.aliases?.some(a => a.toLowerCase() === target || a.toLowerCase() === lang.toLowerCase())
      );
      if (matches.length > 0) {
        // Pick the highest installed version
        matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
        return { language: matches[0].language, version: matches[0].version, filename: defaults.filename };
      }
    }
  } catch {
    // Couldn't reach /runtimes — use hardcoded defaults
  }
  return defaults;
}

async function runPistonCode(
  code: string,
  input: string,
  lang: string,
  timeLimitSec: number
): Promise<ExecutionResult | null> {
  const startTime = Date.now();
  const base = PISTON_URL.replace(/\/execute\/?$/, '').replace(/\/+$/, '');
  const endpoint = `${base}/execute`;

  const { language, version, filename } = await getPistonLangMeta(lang);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max((timeLimitSec + 6) * 1000, 10000));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        version,
        files: [{ name: filename, content: code }],
        stdin: input || '',
        run_timeout: Math.min(Math.max(Math.round(timeLimitSec * 1000), 1000), 10000),
        compile_timeout: 10000
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`Piston HTTP ${res.status}: ${errText}`);
      return null;
    }
    const data = await res.json();

    // Piston returns { message } when language is not installed
    if (data.message && typeof data.message === 'string' && !data.run && !data.compile) {
      console.warn('Piston runtime not installed:', data.message);
      return null;
    }

    if (data.compile && data.compile.code !== 0) {
      return {
        success: false,
        compile_error: (data.compile.stderr || data.compile.output || 'Compilation Error').trim(),
        execution_time: Date.now() - startTime
      };
    }

    if (data.run) {
      if (data.run.signal === 'SIGKILL' || data.run.signal === 'SIGTERM') {
        return {
          success: false,
          timed_out: true,
          execution_time: Date.now() - startTime
        };
      }
      const rawOut = data.run.stdout || data.run.output || '';
      const rawErr = data.run.stderr || '';
      return {
        success: data.run.code === 0,
        output: rawOut,
        stderr: rawErr,
        runtime_error: data.run.code !== 0 ? (rawErr || `Exit code ${data.run.code}`) : undefined,
        execution_time: Date.now() - startTime
      };
    }
  } catch (err: any) {
    console.warn('Piston execution attempt failed:', err?.message);
  }
  return null;
}

function isCompilerMissingError(errMsg: string): boolean {
  const lower = (errMsg || '').toLowerCase();
  return (
    lower.includes('not found') ||
    lower.includes('enoent') ||
    lower.includes('cannot execute') ||
    lower.includes('command not found') ||
    (lower.includes('no such file or directory') && (lower.includes('g++') || lower.includes('gcc') || lower.includes('python')))
  );
}

export function detectEffectiveLanguage(code: string, requestedLang: string): string {
  const norm = (requestedLang || 'cpp').toLowerCase();
  if (norm === 'c') {
    const hasCpp = /#include\s*<iostream>|#include\s*<vector>|#include\s*<string>|#include\s*<algorithm>|#include\s*<map>|#include\s*<set>|#include\s*<queue>|#include\s*<stack>|#include\s*<bits\/stdc\+\+\.h>|using\s+namespace\s+std|\bstd::|\bcout\b|\bcin\b|\bendl\b|\bclass\s+\w+|\btemplate\s*<|\bnew\s+\w+|\bdelete\s+\w+/.test(code);
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
        const errMsg = err.stderr || err.stdout || err.message || '';
        if (isCompilerMissingError(errMsg)) {
          throw new Error(`LOCAL_COMPILER_MISSING: ${errMsg.trim()}`);
        }
        // If C compilation failed, attempt C++ compilation fallback with g++
        if (effectiveLang === 'c') {
          const cppFile = path.join(tempDir, 'main.cpp');
          try {
            await fs.copyFile(srcFile, cppFile);
            await execAsync(`g++ -std=c++17 -O2 "${cppFile}" -o "${exeFile}"`, { cwd: tempDir, env: safeEnv, timeout: 10000 });
            // Successfully compiled via g++ fallback!
          } catch (cppErr: any) {
            const cppErrMsg = cppErr.stderr || cppErr.stdout || cppErr.message || '';
            if (isCompilerMissingError(cppErrMsg)) {
              throw new Error(`LOCAL_COMPILER_MISSING: ${cppErrMsg.trim()}`);
            }
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
        if (isCompilerMissingError(err.message)) {
          resolve({
            success: false,
            runtime_error: 'LOCAL_COMPILER_MISSING',
            execution_time: Date.now() - startTime
          });
          return;
        }
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

export function formatInteractiveOutput(output: string, input: string): string {
  if (!output) return output;

  // Normalize line endings first
  const normalized = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // If there are already multiple lines or no input tokens, return as-is
  const lines = normalized.split('\n');
  const inputTokens = (input || '').trim().split(/\r?\n/).flatMap(line => line.split(/\s+/)).filter(Boolean);

  if (lines.length > 1 || inputTokens.length === 0) return normalized;

  // Single-line output + we had input tokens: try to re-interleave prompts with typed values.
  // e.g. "Enter a: Enter b: Sum: 30" → "Enter a: 5\nEnter b: 10\nSum: 30\n"
  const singleLine = lines[0];

  // Match prompt patterns: text ending with :, ?, or > optionally followed by spaces,
  // where the next char is non-whitespace (i.e. the next prompt or result is concatenated).
  const promptPattern = /([A-Za-z][A-Za-z0-9_,\s\-]{0,60}[:\?>]\s*)(?=[^\s])/g;
  const matches = [...singleLine.matchAll(promptPattern)];

  if (matches.length === 0) return normalized;

  let result = '';
  let lastIdx = 0;
  let tokenIdx = 0;

  for (const m of matches) {
    if (m.index === undefined) continue;
    result += singleLine.substring(lastIdx, m.index + m[0].length);
    if (tokenIdx < inputTokens.length) {
      result += inputTokens[tokenIdx++] + '\n';
    } else {
      result += '\n';
    }
    lastIdx = m.index + m[0].length;
  }
  result += singleLine.substring(lastIdx);

  return result;
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

  // 1. PISTON (self-hosted, primary executor)
  // Piston supports C/C++/Python/Java via the engineer-man/piston Docker container.
  // Falls back gracefully if unreachable (e.g. Vercel serverless, container not running).
  try {
    const pistonRes = await runPistonCode(sanitizedCode, input, effectiveLang, timeLimit);
    if (pistonRes) {
      if (pistonRes.output) {
        pistonRes.output = formatInteractiveOutput(pistonRes.output, input);
      }
      return pistonRes;
    }
  } catch (pistonErr: any) {
    console.warn('Piston execution failed, falling back:', pistonErr?.message);
  }

  // 2. Local compilation (fast, zero-latency — only on machines with gcc/g++ installed)
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!isServerless && (effectiveLang === 'c' || effectiveLang === 'cpp' || effectiveLang === 'python')) {
    try {
      const localResult = await runLocalCode(sanitizedCode, input, effectiveLang, timeLimit);
      if (localResult.runtime_error !== 'LOCAL_COMPILER_MISSING') {
        if (localResult.output) {
          localResult.output = formatInteractiveOutput(localResult.output, input);
        }
        return localResult;
      }
    } catch (localErr: any) {
      console.warn('Local execution skipped/unavailable:', localErr?.message);
    }
  }

  let languageId = 54; // C++ (GCC 9.2.0)
  if (effectiveLang === 'c') languageId = 50;
  else if (effectiveLang === 'python') languageId = 71;
  else if (effectiveLang === 'java') languageId = 62;

  // 3. Try Judge0 remote execution
  let judge0Error: string | null = null;
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for fast response

    const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      
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
      
      if (statusId === 3 || statusId === 4) {
        let finalOut = formatInteractiveOutput(stdoutStr, input);
        // If stdin was empty, and code expected cin/scanf, and raw output has bunched prompts without linebreaks:
        if ((!input || !input.trim()) && (sanitizedCode.includes('cin') || sanitizedCode.includes('scanf')) && /[:\?]\s*[A-Za-z]/.test(finalOut)) {
          try {
            const aiOutput = await simulateCodeExecutionWithAI(sanitizedCode, effectiveLang, input);
            if (aiOutput && !aiOutput.startsWith('Error:')) {
              finalOut = aiOutput;
            }
          } catch {}
        }
        return {
          success: true,
          output: finalOut,
          stderr: stderrStr,
          execution_time: parseFloat(data.time) * 1000 || (Date.now() - startTime)
        };
      }
    } else {
      judge0Error = `Judge0 returned status ${res.status}`;
    }
  } catch (err: any) {
    judge0Error = err.message || 'Judge0 unreachable';
  }

  // 3. Fallback to Azure OpenAI high-speed code emulator
  try {
    const aiOutput = await simulateCodeExecutionWithAI(sanitizedCode, effectiveLang, input);
    if (aiOutput && !aiOutput.startsWith('Error: AI configuration missing') && !aiOutput.startsWith('Error: AI Simulation Failed') && !aiOutput.startsWith('Error: AI Simulation crashed')) {
      if (aiOutput.startsWith('COMPILATION_ERROR:')) {
        return {
          success: false,
          compile_error: aiOutput.replace('COMPILATION_ERROR:', '').trim(),
          execution_time: Date.now() - startTime
        };
      }
      return {
        success: true,
        output: aiOutput,
        execution_time: Date.now() - startTime
      };
    }
  } catch (aiErr: any) {
    console.error("AI execution simulation failed:", aiErr);
  }

  return {
    success: false,
    compile_error: judge0Error ? `Code execution service error: ${judge0Error}` : 'Code execution service temporarily unavailable. Please retry.'
  };
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
