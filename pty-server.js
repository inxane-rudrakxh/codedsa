const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const cors = require('cors');
const { jwtVerify } = require('jose');

// Load environment variables from .env.local if present
try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[match[1]]) {
          process.env[match[1]] = val.trim();
        }
      }
    }
  }
} catch (e) {
  console.warn('Could not read .env.local in pty-server:', e.message);
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'codedsa-dev-secret-key-at-least-32-chars-long'
);

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Authenticate socket connections using JWT
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication required: Missing token'));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload) {
      return next(new Error('Invalid token'));
    }
    socket.user = payload;
    next();
  } catch (err) {
    return next(new Error('Authentication failed: ' + (err.message || 'Invalid session')));
  }
});

io.on('connection', (socket) => {
  let ptyProcess = null;
  let workDir = null;

  socket.on('execute', ({ code, language, timeLimit = 15000 }) => {
    // Input validation: bounded code size (max 64KB)
    if (!code || typeof code !== 'string' || code.length > 65536) {
      socket.emit('output', '\x1b[31m[Error: Code payload is empty or exceeds maximum size limit of 64KB]\x1b[0m\r\n');
      socket.emit('finished');
      return;
    }

    // Bound execution timeout between 1s and 30s
    const safeTimeLimit = Math.min(Math.max(Number(timeLimit) || 15000, 1000), 30000);

    // Generate a unique workspace
    const runId = crypto.randomBytes(8).toString('hex');
    workDir = path.join(os.tmpdir(), `run_${runId}`);
    fs.mkdirSync(workDir, { recursive: true });

    // Isolated environment to prevent leaking secrets to student code
    const safeEnv = {
      TERM: 'xterm-256color',
      PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      HOME: workDir,
      TMPDIR: workDir,
    };

    let sourceFile, outFile, compileCmd, runCmd, runArgs, runLabel;
    let lang = (language || 'cpp').toLowerCase();

    // Auto-detect C++ features if language was sent as C
    const hasCpp = /#include\s*<iostream>|#include\s*<vector>|#include\s*<string>|#include\s*<algorithm>|#include\s*<map>|#include\s*<set>|#include\s*<queue>|#include\s*<stack>|#include\s*<bits\/stdc\+\+\.h>|using\s+namespace\s+std|\bstd::|\bcout\b|\bcin\b|\bendl\b|\bclass\s+\w+|\btemplate\s*<|\bnew\s+\w+|\bdelete\s+\w+/.test(code);
    if (lang === 'c' && hasCpp) {
      lang = 'cpp';
    }

    if (lang === 'c') {
      sourceFile = path.join(workDir, `main.c`);
      outFile = path.join(workDir, `a.out`);
      compileCmd = `gcc -std=c11 -O2 "${sourceFile}" -o "${outFile}" -lm`;
      runCmd = outFile;
      runArgs = [];
      runLabel = 'gcc main.c -o a.out && ./a.out';
    } else if (lang === 'cpp') {
      sourceFile = path.join(workDir, `main.cpp`);
      outFile = path.join(workDir, `a.out`);
      compileCmd = `g++ -std=c++17 -O2 "${sourceFile}" -o "${outFile}"`;
      runCmd = outFile;
      runArgs = [];
      runLabel = 'g++ -std=c++17 main.cpp -o a.out && ./a.out';
    } else if (lang === 'python') {
      sourceFile = path.join(workDir, `main.py`);
      compileCmd = null; // No compilation
      runCmd = 'python3';
      runArgs = ['-u', sourceFile];
      runLabel = 'python3 main.py';
    } else if (lang === 'java') {
      sourceFile = path.join(workDir, `Main.java`);
      compileCmd = `javac "${sourceFile}"`;
      runCmd = 'java';
      runArgs = ['-cp', workDir, 'Main'];
      runLabel = 'javac Main.java && java Main';
    } else {
      socket.emit('output', '\x1b[31m[Language not supported in this interactive terminal]\x1b[0m\r\n');
      socket.emit('finished');
      return;
    }
    
    fs.writeFileSync(sourceFile, code);

    const executeRun = () => {
      socket.emit('output', `\x1b[1;32m✔ Build successful\x1b[0m\r\n\x1b[1;36m$\x1b[0m \x1b[90m${runLabel}\x1b[0m\r\n\r\n`);
      try {
        ptyProcess = pty.spawn(runCmd, runArgs, {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: workDir,
          env: safeEnv
        });
      } catch (spawnError) {
        socket.emit('output', `\r\n\x1b[31m[Execution Error: Could not spawn process: ${spawnError.message}]\x1b[0m\r\n`);
        socket.emit('finished');
        return;
      }

      let finished = false;

      const timeout = setTimeout(() => {
        if (!finished) {
          if (ptyProcess) ptyProcess.kill();
          socket.emit('output', `\r\n\x1b[1;31m✖ Time Limit Exceeded (${safeTimeLimit / 1000}s)\x1b[0m\r\n`);
          socket.emit('finished');
          finished = true;
        }
      }, safeTimeLimit);

      ptyProcess.onData((data) => {
        socket.emit('output', data);
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (finished) return;
        clearTimeout(timeout);
        finished = true;
        socket.emit('output', `\r\n\x1b[90m----------------------------------------\r\n[Process completed with exit code ${exitCode}]\x1b[0m\r\n`);
        socket.emit('finished');
      });
    };

    if (compileCmd) {
      socket.emit('output', `\x1b[1;33m● Compiling ${lang.toUpperCase()} source...\x1b[0m\r\n`);
      exec(compileCmd, { cwd: workDir, env: safeEnv }, (error, stdout, stderr) => {
        if (error) {
          // If C compilation failed, attempt fallback to g++
          if (lang === 'c') {
            const cppFile = path.join(workDir, `main.cpp`);
            fs.copyFileSync(sourceFile, cppFile);
            const fallbackCmd = `g++ -std=c++17 -O2 "${cppFile}" -o "${outFile}"`;
            exec(fallbackCmd, { cwd: workDir, env: safeEnv }, (cppErr) => {
              if (!cppErr) {
                runLabel = 'g++ -std=c++17 main.cpp -o a.out && ./a.out';
                executeRun();
              } else {
                const errStr = (stderr || error.message || '').replace(/\n/g, '\r\n');
                socket.emit('output', `\r\n\x1b[1;31m✖ Compilation Error:\x1b[0m\r\n\x1b[31m${errStr}\x1b[0m\r\n`);
                socket.emit('finished');
              }
            });
            return;
          }
          const errStr = (stderr || error.message || '').replace(/\n/g, '\r\n');
          socket.emit('output', `\r\n\x1b[1;31m✖ Compilation Error:\x1b[0m\r\n\x1b[31m${errStr}\x1b[0m\r\n`);
          socket.emit('finished');
          return;
        }
        executeRun();
      });
    } else {
      executeRun();
    }
  });

  socket.on('input', (data) => {
    if (ptyProcess) {
      ptyProcess.write(data);
    }
  });

  socket.on('disconnect', () => {
    if (ptyProcess) {
      ptyProcess.kill();
    }
    if (workDir && fs.existsSync(workDir)) {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch (e) {}
    }
  });
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`PTY Execution Server listening on port ${PORT}`);
});
