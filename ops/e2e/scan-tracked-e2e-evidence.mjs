#!/usr/bin/env node
// Bounded, tracked-source scan. It intentionally does not inspect ignored raw logs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const candidates = execFileSync('git', ['ls-files', '.maestro', 'ops/e2e'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  .filter((file) => file.startsWith('.maestro/') || file.startsWith('ops/e2e/evidence/') || file === 'ops/e2e/T-RN-E2E-01.md');
const rules = [
  ['email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['plaintext password', /(?:password|passwd)\s*[:=]\s*["'](?!\$\{|\[REDACTED\])[^"']{3,}["']/i],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['bearer credential', /Bearer\s+(?!\[REDACTED\])[A-Za-z0-9._-]{12,}/i],
  ['high precision coordinate', /-?\d{1,3}\.\d{4,}\b/],
  ['decimal codepoint sequence', /(?:\d{5,}\D+){5,}\d{5,}/],
];
const findings = [];
for (const file of candidates) {
  const content = fs.readFileSync(file, 'utf8');
  for (const [name, expression] of rules) if (expression.test(content)) findings.push(`${file}: ${name}`);
}
if (findings.length) {
  console.error(`E2E secret scan failed:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`E2E secret scan passed (${candidates.length} tracked files, bounded scope).`);
