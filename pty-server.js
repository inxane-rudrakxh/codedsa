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

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  let ptyProcess = null;
  let workDir = null;

  socket.on('execute', ({ code, language, timeLimit = 50000 }) => {
    // Generate a unique workspace
    const runId = crypto.randomBytes(8).toString('hex');
    workDir = path.join(os.tmpdir(), `run_${runId}`);
    fs.mkdirSync(workDir, { recursive: true });

    if (language !== 'cpp' && language !== 'c') {
      socket.emit('output', 'Language not supported in this interactive terminal.\r\n');
      return;
    }

    const sourceFile = path.join(workDir, `main.cpp`);
    const outFile = path.join(workDir, `a.out`);
    
    fs.writeFileSync(sourceFile, code);
    
    socket.emit('output', '\x1b[33mCompiling...\x1b[0m\r\n');

    // Compile
    exec(`g++ -std=c++17 -O2 ${sourceFile} -o ${outFile}`, (error, stdout, stderr) => {
      if (error) {
        socket.emit('output', `\x1b[31mCompilation Error:\x1b[0m\r\n${stderr.replace(/\n/g, '\r\n')}`);
        socket.emit('finished');
        return;
      }

      socket.emit('output', '\x1b[32mSuccessfully compiled. Running...\x1b[0m\r\n\r\n');

      try {
        // Run with PTY
        ptyProcess = pty.spawn(outFile, [], {
          name: 'xterm-color',
          cols: 80,
          rows: 24,
          cwd: workDir,
          env: process.env
        });
      } catch (spawnError) {
        socket.emit('output', `\\r\\n\\x1b[31m[Execution Error: Could not spawn process: ${spawnError.message}]\\x1b[0m\\r\\n`);
        socket.emit('finished');
        return;
      }

      let finished = false;

      // Kill the process if it exceeds the time limit
      // Given this is an interactive session, we might want a longer time limit or reset it on input
      const timeout = setTimeout(() => {
        if (!finished) {
          if (ptyProcess) ptyProcess.kill();
          socket.emit('output', `\r\n\x1b[31m[Time Limit Exceeded (${timeLimit / 1000}s)]\x1b[0m\r\n`);
          socket.emit('finished');
          finished = true;
        }
      }, timeLimit);

      ptyProcess.onData((data) => {
        socket.emit('output', data);
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        if (finished) return;
        clearTimeout(timeout);
        finished = true;
        socket.emit('output', `\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
        socket.emit('finished');
      });
    });
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
