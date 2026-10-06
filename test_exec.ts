import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

const COMPILE_TIMEOUT_MS = 5000;
const EXEC_TIMEOUT_MS = 2000;
const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB

export async function compileAndRun(code: string, input: string, language: string = 'cpp') {
  const startTime = Date.now();
  
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
        stderr: (execErr.stderr || execErr.message || '').trim(),
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

async function test() {
  const code = `#include <iostream>\nusing namespace std;\nint main() {\nint a;\ncin >> a;\ncout << "Square: " << a*a << endl;\nreturn 0;\n}`;
  const res = await compileAndRun(code, '5\n', 'cpp');
  console.log(res);
}

test();
