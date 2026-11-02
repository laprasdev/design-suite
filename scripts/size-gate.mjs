// The size gate: every file in scope holds 200 lines and 120 characters a line, or is no worse than its baseline.
//   node scripts/size-gate.mjs           check, and on a pass write any lower numbers (the ratchet)
//   node scripts/size-gate.mjs --check   check only, writing nothing
//   node scripts/size-gate.mjs --init    write a first baseline; refused once one exists
//   node scripts/size-gate.mjs --allow <path> --step <step> --reason "<why>"   import lines a split added, nothing else
// The web synth runs it on its own files through scripts/size-gate.mjs there, which calls `run`.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare } from './sizeGate/compare.mjs';
import { measureScope } from './sizeGate/measure.mjs';
import { allowed, freshBaseline, ratcheted, readBaseline, writeBaseline } from './sizeGate/baselineFile.mjs';

const Flag = Object.freeze({ CHECK: '--check', INIT: '--init', ALLOW: '--allow', STEP: '--step', REASON: '--reason' });
const MODES = [Flag.CHECK, Flag.INIT, Flag.ALLOW];
const today = () => new Date().toISOString().slice(0, 10);

/** This repo's scope, read only by --init: afterwards the baseline carries it. */
const SUITE_SCOPE = {
  dirs: ['src', 'tests', 'scripts', 'catalog'], files: [], extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  skip: { directories: ['node_modules', 'dist', '__snapshots__'], suffixes: ['.d.ts', '.meta'] },
};

function flagValue(argv, flag) {
  const value = argv[argv.indexOf(flag) + 1];
  if (!argv.includes(flag) || !value || value.startsWith('--')) throw new Error(`size-gate: ${flag} needs a value.`);
  return value;
}

function modeOf(argv) {
  const modes = MODES.filter(mode => argv.includes(mode));
  if (modes.length > 1) throw new Error(`size-gate: pick one of ${modes.join(', ')}.`);
  return modes[0];
}

function gate({ root, baselinePath, say }, write) {
  const baseline = readBaseline(baselinePath);
  const measured = measureScope(root, baseline.scope);
  const { problems, notices } = compare(measured, baseline);
  [...problems, ...notices].forEach(say);
  if (!problems.length && write && notices.length) writeBaseline(baselinePath, ratcheted(baseline, measured));
  say(`${problems.length} problems, ${Object.keys(baseline.files).length} files baselined`);
  return problems.length ? 1 : 0;
}

function init({ root, baselinePath, scope, say }) {
  if (existsSync(baselinePath)) throw new Error(`size-gate: ${baselinePath} exists, and a baseline only shrinks.`);
  const baseline = freshBaseline(scope, measureScope(root, scope));
  writeBaseline(baselinePath, baseline);
  say(`wrote ${baselinePath} with ${Object.keys(baseline.files).length} files baselined`);
  return 0;
}

function allow(job) {
  const { root, baselinePath, argv, say } = job;
  const baseline = readBaseline(baselinePath);
  const file = flagValue(argv, Flag.ALLOW), step = flagValue(argv, Flag.STEP), reason = flagValue(argv, Flag.REASON);
  const grant = { path: file, step, reason, date: today() };
  writeBaseline(baselinePath, allowed(baseline, measureScope(root, baseline.scope), grant));
  say(`allowed ${file} its import lines for step ${step}`);
  return gate(job, false);
}

/** Runs the gate for a repo and returns its exit code. `scope` is read only by --init; `log` takes each line. */
export function run({ root, baselinePath, scope, argv = [], log = console.log }) {
  const job = { root, baselinePath, scope, argv, say: line => log(`size-gate: ${line}`) };
  const mode = modeOf(argv);
  if (mode === Flag.INIT) return init(job);
  if (mode === Flag.ALLOW) return allow(job);
  return gate(job, mode !== Flag.CHECK);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const baselinePath = path.join(root, 'scripts/size-baseline.json');
  process.exitCode = run({ root, baselinePath, scope: SUITE_SCOPE, argv: process.argv.slice(2) });
}
