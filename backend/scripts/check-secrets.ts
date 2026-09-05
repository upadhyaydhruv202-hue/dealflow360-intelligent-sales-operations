import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { findCommittedSecrets } from '../src/security/secrets-scan';

const repoRoot = path.resolve(__dirname, '../..');

function gitTrackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot });
  return output
    .toString('utf8')
    .split('\0')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const files = gitTrackedFiles().map((relative) => {
  const absolute = path.join(repoRoot, relative);
  let content = '';
  try {
    content = fs.readFileSync(absolute, 'utf8');
  } catch {
    content = '';
  }
  return { path: relative, content };
});

const findings = findCommittedSecrets(files);
if (findings.length > 0) {
  console.error('Committed secret-like material was detected:');
  for (const finding of findings) {
    console.error(`  - ${finding.path}: ${finding.reason}`);
  }
  process.exit(1);
}

console.log(`Scanned ${files.length} tracked files. No committed secrets detected.`);
