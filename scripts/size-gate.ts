// The size gate: every file in scope holds 200 lines and 120 characters a line, or is no worse than its baseline.
//   node scripts/size-gate.ts           check, and on a pass write any lower numbers (the ratchet)
//   node scripts/size-gate.ts --check   check only, writing nothing
//   node scripts/size-gate.ts --init    write a first baseline; refused once one exists
//   node scripts/size-gate.ts --rewrite  rewrite the baseline to the current format, dropping only the fields an
//     earlier format recorded and keeping every number and allowance as it is; nothing is measured
//   node scripts/size-gate.ts --allow <path> --step <step> --reason "<why>"   import lines a split added, nothing else,
//     measured against the file as origin/main holds it
// Consumers run it on their own files through their own scripts/size-gate entry, which calls `run`.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_BRANCH, baseBranchAbsence } from './baseline/baseBranch.ts';
import { REWRITE_FLAG, Reading } from './baseline/baselinedFiles.ts';
import { allowed, freshBaseline, ratcheted, readBaseline, writeBaseline } from './sizeGate/baselineFile.ts';
import { compare } from './sizeGate/compare.ts';
import type { SizeScope } from './sizeGate/limits.ts';
import { measureCommitted, measureScope } from './sizeGate/measure.ts';

const Flag = Object.freeze({
  CHECK: '--check', INIT: '--init', REWRITE: REWRITE_FLAG, ALLOW: '--allow', STEP: '--step', REASON: '--reason',
} as const);
type ModeFlag = typeof Flag.CHECK | typeof Flag.INIT | typeof Flag.REWRITE | typeof Flag.ALLOW;
const MODES: readonly ModeFlag[] = [Flag.CHECK, Flag.INIT, Flag.REWRITE, Flag.ALLOW];
const today = (): string => new Date().toISOString().slice(0, 10);

/** This repo's baseline, from its root, whose scope names the repository's source for every gate. */
export const SUITE_BASELINE = 'scripts/size-baseline.json';

/** This repo's scope, read only by --init: afterwards the baseline carries it. */
const SUITE_SCOPE: SizeScope = {
  dirs: ['.'],
  files: [],
  extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
  skip: { directories: [], suffixes: [] },
};

export interface SizeGateOptions {
  readonly root: string;
  readonly baselinePath: string;
  readonly scope: SizeScope;
  readonly argv?: readonly string[];
  readonly log?: (line: string) => void;
}

/** One run's options, with `log` bound to the gate's prefix as `say`. */
type GateJob = Required<Omit<SizeGateOptions, 'log'>> & { readonly say: (line: string) => void };

function flagValue(argv: readonly string[], flag: string): string {
  const value = argv[argv.indexOf(flag) + 1];
  if (!argv.includes(flag) || !value || value.startsWith('--')) throw new Error(`size-gate: ${flag} needs a value.`);
  return value;
}

function modeOf(argv: readonly string[]): ModeFlag | undefined {
  const modes = MODES.filter(mode => argv.includes(mode));
  if (modes.length > 1) throw new Error(`size-gate: pick one of ${modes.join(', ')}.`);
  return modes[0];
}

function gate({ root, baselinePath, say }: GateJob, write: boolean): number {
  const baseline = readBaseline(baselinePath, Reading.CURRENT);
  const measured = measureScope(root, baseline.scope);
  const { problems, notices } = compare(measured, baseline);
  [...problems, ...notices].forEach(say);
  if (!problems.length && write && notices.length) writeBaseline(baselinePath, ratcheted(baseline, measured));
  say(`${problems.length} problems, ${Object.keys(baseline.files).length} files baselined`);
  return problems.length ? 1 : 0;
}

function init({ root, baselinePath, scope, say }: GateJob): number {
  if (existsSync(baselinePath)) throw new Error(`size-gate: ${baselinePath} exists, and a baseline only shrinks.`);
  const baseline = freshBaseline(scope, measureScope(root, scope));
  writeBaseline(baselinePath, baseline);
  say(`wrote ${baselinePath} with ${Object.keys(baseline.files).length} files baselined`);
  return 0;
}

function rewrite({ baselinePath, say }: GateJob): number {
  const baseline = readBaseline(baselinePath, Reading.REWRITE);
  writeBaseline(baselinePath, baseline);
  const kept = `${Object.keys(baseline.files).length} files and ${baseline.allowances.length} allowances`;
  say(`rewrote ${baselinePath} to the current format, keeping ${kept} as they were`);
  return 0;
}

function allow(job: GateJob): number {
  const { root, baselinePath, argv, say } = job;
  const baseline = readBaseline(baselinePath, Reading.CURRENT);
  const file = flagValue(argv, Flag.ALLOW), step = flagValue(argv, Flag.STEP), reason = flagValue(argv, Flag.REASON);
  const absence = baseBranchAbsence(root);
  if (absence) throw new Error(`size-gate: ${absence}.`);
  const grant = { path: file, step, reason, date: today() };
  const committed = measureCommitted(root, BASE_BRANCH, file);
  writeBaseline(baselinePath, allowed(baseline, measureScope(root, baseline.scope), grant, committed));
  say(`allowed ${file} its import lines for step ${step}`);
  return gate(job, false);
}

/** Runs the gate for a repo and returns its exit code. `scope` is read only by --init; `log` takes each line. */
export function run({ root, baselinePath, scope, argv = [], log = console.log }: SizeGateOptions): number {
  const job: GateJob = { root, baselinePath, scope, argv, say: line => log(`size-gate: ${line}`) };
  const mode = modeOf(argv);
  if (mode === Flag.INIT) return init(job);
  if (mode === Flag.REWRITE) return rewrite(job);
  if (mode === Flag.ALLOW) return allow(job);
  return gate(job, mode !== Flag.CHECK);
}

if (import.meta.main) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const baselinePath = path.join(root, SUITE_BASELINE);
  process.exitCode = run({ root, baselinePath, scope: SUITE_SCOPE, argv: process.argv.slice(2) });
}
