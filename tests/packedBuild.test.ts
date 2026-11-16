import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  OTHER_FIELDS, holdsListOf, holdsNonEmptyString, holdsShape, refusalBy, type FieldCheck,
} from '../scripts/build/fieldChecks.ts';
import { FONT_FILES, FONT_HOLDERS, fontHolderFolder } from '../src/fonts.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** The folder npm extracts a packed package into. */
const PACKAGE_FOLDER = 'package';
/** What `npm pack --json` says of each package it packed, as far as this test reads it. */
const holdsPackOutput: FieldCheck<readonly { readonly filename: string }[]> =
  holdsListOf(holdsShape({ filename: holdsNonEmptyString }, OTHER_FIELDS.ignored));

describe('the packed package', () => {
  it('builds from what it ships, every import of its build script inside the pack', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'packed-build-'));
    try {
      const packed = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      const output: unknown = JSON.parse(packed);
      holdsPackOutput(output, '', refusalBy(reason => assert.fail(`npm pack --json: ${reason}.`), 'its output'));
      const [{ filename }] = output;
      execFileSync('tar', ['-xzf', path.join(scratch, filename), '-C', scratch]);
      const shipped = path.join(scratch, PACKAGE_FOLDER);
      // The build's own tools come from this checkout's install; every file it imports must come from the pack.
      symlinkSync(path.join(ROOT, 'node_modules'), path.join(shipped, 'node_modules'));
      const built = execFileSync('npm', ['run', 'build'], {
        cwd: shipped, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      assert.match(built, /^Built @looms\/bloom-design@.+: \d+ public entrypoints\.$/m);
      const roots = { [FONT_HOLDERS.suite]: shipped, [FONT_HOLDERS.engine]: ROOT };
      const builtFonts = fontHolderFolder(FONT_HOLDERS.suite, roots);
      for (const face of FONT_FILES.filter(file => file.holder === FONT_HOLDERS.suite)) {
        assert.ok(existsSync(path.join(builtFonts, face.file)), `the build ships no ${face.file}`);
      }
    } finally {
      rmSync(scratch, { recursive: true });
    }
  });
});
