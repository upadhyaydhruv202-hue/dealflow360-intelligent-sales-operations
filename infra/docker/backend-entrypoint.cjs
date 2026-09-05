'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = '/app';
const backendDir = path.join(appRoot, 'backend');
const schemaPath = path.join(appRoot, 'database', 'prisma', 'schema.prisma');
const binDir = path.join(appRoot, 'node_modules', '.bin');

process.chdir(backendDir);
process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ''}`;

const role = process.argv[2] || 'api';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

function execProcess(command, args) {
  const child = spawn(command, args, { stdio: 'inherit', windowsHide: true });
  const forward = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };
  process.on('SIGTERM', () => forward('SIGTERM'));
  process.on('SIGINT', () => forward('SIGINT'));
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

async function main() {
  if (role === 'worker') {
    if (fs.existsSync(path.join(backendDir, 'dist', 'worker.js'))) {
      execProcess(process.execPath, [path.join(backendDir, 'dist', 'worker.js')]);
      return;
    }
    execProcess('tsx', ['src/worker.ts']);
    return;
  }

  await run('prisma', ['migrate', 'deploy', '--schema', schemaPath]);

  if ((process.env.SEED_ON_START ?? 'false') === 'true') {
    await run('prisma', ['db', 'seed', '--schema', schemaPath]);
  }

  if (fs.existsSync(path.join(backendDir, 'dist', 'index.js'))) {
    execProcess(process.execPath, [path.join(backendDir, 'dist', 'index.js')]);
    return;
  }

  execProcess('tsx', ['src/index.ts']);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
