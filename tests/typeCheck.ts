// Source used as a consumer would write it, checked by the suite's own TypeScript: the files go into a scratch
// directory beside a tsconfig.json naming them, and the test reads what tsc reports. A contract that a wrong value
// fails the type check is then one call.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {SUITE_ROOT, scratchDirectory} from './bundled.ts';

const SUITE_CONFIG: {compilerOptions: Readonly<Record<string, unknown>>, include: readonly string[]} =
  JSON.parse(readFileSync(join(SUITE_ROOT, 'tsconfig.json'), 'utf8'));
/** The compiler options `npm run check` holds the suite's source to. */
export const SUITE_COMPILER_OPTIONS = SUITE_CONFIG.compilerOptions;
// The ambient declarations in the suite's own program (its CSS custom properties among them), which a usage's
// program takes too: its `files` name only the usage, so tsc would not find them.
const SUITE_DECLARATIONS = SUITE_CONFIG.include.flatMap(directory =>
  readdirSync(join(SUITE_ROOT, directory), {recursive: true, encoding: 'utf8'})
    .filter(file => file.endsWith('.d.ts')).map(file => join(SUITE_ROOT, directory, file)));

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
    writeFileSync(config, JSON.stringify({files: [...Object.keys(files), ...SUITE_DECLARATIONS], compilerOptions}));
    for (const [file, text] of Object.entries(files)) writeFileSync(join(directory, file), text);
    const run = spawnSync(join(SUITE_ROOT, 'node_modules/.bin/tsc'), ['-p', config, '--pretty', 'false'],
      {encoding: 'utf8'});
    return {status: run.status, output: run.stdout + run.stderr, errors: run.stdout.match(/error TS\d+/g) ?? []};
  } finally {
    dispose();
  }
}

/** A usage the type check accepts and the usages it refuses beside it, as a table row of a type test. */
export interface TypeRefusal {
  readonly accepted: string;
  readonly refused: readonly [string, ...string[]];
}

/** That a usage with `accepted` passes the type check, once, and each `refused` usage fails it as a mistyped value
 * (TS2322). */
export function assertRefusesType(check: (value: string) => TypeCheck, accepted: string,
  ...refused: TypeRefusal['refused']) {
  const valid = check(accepted);
  assert.equal(valid.status, 0, valid.output);
  for (const value of refused) {
    const invalid = check(value);
    assert.notEqual(invalid.status, 0, value);
    assert.deepEqual(invalid.errors, ['error TS2322'], value);
  }
}
