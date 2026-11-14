// Source used as a consumer would write it, checked by the suite's own TypeScript: the files go into a scratch
// directory beside a tsconfig.json naming them, and the test reads what tsc reports. A contract that a wrong value
// fails the type check is then one call.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {SUITE_ROOT, scratchDirectory} from './bundled.ts';

/** The compiler options `npm run check` holds the suite's source to. */
export const SUITE_COMPILER_OPTIONS: Readonly<Record<string, unknown>> =
  JSON.parse(readFileSync(join(SUITE_ROOT, 'tsconfig.json'), 'utf8')).compilerOptions;

export interface TypeCheck {
  readonly status: number | null;
  readonly output: string;
  /** Each error's code, in the order tsc reported them. */
  readonly errors: readonly string[];
}

/** Runs tsc on `files` under `compilerOptions`, in a scratch directory it removes afterwards. */
export function typeCheck(files: Readonly<Record<string, string>>,
  compilerOptions: Readonly<Record<string, unknown>>): TypeCheck {
  const {directory, dispose} = scratchDirectory('type-check');
  try {
    const config = join(directory, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({files: Object.keys(files), compilerOptions}));
    for (const [file, text] of Object.entries(files)) writeFileSync(join(directory, file), text);
    const run = spawnSync(join(SUITE_ROOT, 'node_modules/.bin/tsc'), ['-p', config, '--pretty', 'false'],
      {encoding: 'utf8'});
    return {status: run.status, output: run.stdout + run.stderr, errors: run.stdout.match(/error TS\d+/g) ?? []};
  } finally {
    dispose();
  }
}

/** That a usage with `accepted` passes the type check, and one with `refused` fails it as a mistyped value (TS2322). */
export function assertRefusesType(check: (value: string) => TypeCheck, accepted: string, refused: string) {
  const valid = check(accepted);
  assert.equal(valid.status, 0, valid.output);
  const invalid = check(refused);
  assert.notEqual(invalid.status, 0);
  assert.deepEqual(invalid.errors, ['error TS2322']);
}
