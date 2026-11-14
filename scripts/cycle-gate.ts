// The cycle gate: dependency-cruiser over the directory it runs in, with that directory's .dependency-cruiser.json.
// dependency-cruiser reads TypeScript through the TypeScript 6 compiler installed beside it in scripts/gateTools.
// When it can't load one it skips every .ts and .tsx file, finds no cycle and passes, so this gate refuses that cruise.
//   node scripts/cycle-gate.ts
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRecord } from '../src/valueChecks.ts';

const DEPCRUISE = fileURLToPath(new URL('gateTools/node_modules/.bin/depcruise', import.meta.url));
const CONFIG = ['--config', '.dependency-cruiser.json'];
/** A pattern no path matches: a cruise of no module still reports which transpilers dependency-cruiser loaded. */
const NO_MODULE = '^$';
/** The name dependency-cruiser's summary gives the TypeScript compiler among the transpilers it looked for. */
const TYPESCRIPT = 'typescript';

const refuse = (problem: string): never => {
  throw new Error(`cycle gate: ${problem}`);
};

/** Runs dependency-cruiser with `args`, returning what it wrote and its exit status. */
function depcruise(args: string[], stdout: 'pipe' | 'inherit'): { status: number; output: string } {
  const run = spawnSync(DEPCRUISE, [...CONFIG, ...args, '.'],
    { stdio: ['ignore', stdout, 'inherit'], encoding: 'utf8' });
  if (run.error) refuse(`dependency-cruiser did not run (${run.error.message}); install it: npm run gate-tools.`);
  const status = run.status ?? refuse(`dependency-cruiser ended on signal ${run.signal}.`);
  return { status, output: run.stdout ?? '' };
}

const field = (value: unknown, name: string): unknown =>
  isRecord(value) && Object.hasOwn(value, name) ? value[name]
    : refuse(`dependency-cruiser's result has no ${name}.`);

/** Whether dependency-cruiser loaded a TypeScript compiler, by the transpilers its summary says it found. */
function loadedTypeScript(): boolean {
  const environment = depcruise(['--output-type', 'json', '--include-only', NO_MODULE], 'pipe');
  if (environment.status !== 0) refuse('dependency-cruiser failed to report its environment.');
  const found = field(field(field(JSON.parse(environment.output), 'summary'), 'environment'), 'transpilersFound');
  if (!Array.isArray(found)) return refuse("dependency-cruiser's transpilersFound is not a list.");
  return found.some(transpiler => field(transpiler, 'name') === TYPESCRIPT && field(transpiler, 'available') === true);
}

if (!loadedTypeScript()) {
  refuse('dependency-cruiser loaded no TypeScript compiler it supports, so it would read no .ts or .tsx file. '
    + 'Install scripts/gateTools with npm run gate-tools.');
}
// dependency-cruiser exits with the number of errors, and an exit status is that number mod 256: 256 cycles would pass.
process.exitCode = depcruise(['--output-type', 'err'], 'inherit').status === 0 ? 0 : 1;
