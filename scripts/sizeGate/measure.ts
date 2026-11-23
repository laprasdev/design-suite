// What the size gate reads of each file: its physical lines, the lines over the character limit, and the lines that
// belong to import statements, which a split may add to a file that imports what it moved.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gitOutput, gitSucceeds, repositoryFiles } from '../repositoryFiles.ts';
import { LINE_CHARACTER_LIMIT, type FileMeasurement, type SizeScope, type SizeSkip } from './limits.ts';

const IMPORT_START = /^import[\s{*'"]/;
const IMPORT_END = /['"][^'"]*['"]\s*;?\s*(\/\/.*)?$/;
const CARRIAGE_RETURN = /\r$/;

/** The lines an editor numbers. A final newline ends the last line rather than starting another. */
function physicalLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines;
}

const characters = (line: string): number => [...line.replace(CARRIAGE_RETURN, '')].length;

/** Lines from an `import` at the start of a line to the module name that ends it. */
function importLineCount(lines: readonly string[]): number {
  let count = 0, open = false;
  for (const line of lines) {
    open ||= IMPORT_START.test(line);
    if (!open) continue;
    count++;
    open = !IMPORT_END.test(line);
  }
  return count;
}

/** One file's numbers. `long` names each line over the limit, by its 1-based number and length. */
export function measureText(text: string): FileMeasurement {
  const lines = physicalLines(text);
  const long = lines.flatMap((line, index) => {
    const length = characters(line);
    return length > LINE_CHARACTER_LIMIT ? [{ line: index + 1, characters: length }] : [];
  });
  return { lines: lines.length, longLines: long.length, importLines: importLineCount(lines), long };
}

/** The numbers of `file`, a path from `root`, as the commit `ref` holds it, or undefined when it holds no such file. */
export function measureCommitted(root: string, ref: string, file: string): FileMeasurement | undefined {
  const blob = `${ref}:./${file}`;
  return gitSucceeds(root, ['cat-file', '-e', blob]) ? measureText(gitOutput(root, ['show', blob])) : undefined;
}

/** The numbers of `file`, a path from `root`, in the working tree, or undefined when it holds no such file. */
export function measureWorking(root: string, file: string): FileMeasurement | undefined {
  const full = path.join(root, file);
  return existsSync(full) ? measureText(readFileSync(full, 'utf8')) : undefined;
}

/** Whether a suffix or a folder on the way to `file` puts it out of scope. */
const skipped = (file: string, skip: SizeSkip): boolean => skip.suffixes.some(suffix => file.endsWith(suffix))
  || file.split('/').slice(0, -1).some(folder => skip.directories.includes(folder));

/** Whether `file` sits in `dir`; `.` is the whole repository. */
function inside(dir: string, file: string): boolean {
  const relative = path.posix.relative(dir, file);
  return relative !== '..' && !relative.startsWith('../');
}

function existing(root: string, paths: readonly string[]): void {
  const missing = paths.filter(entry => !existsSync(path.join(root, entry)));
  if (missing.length) throw new Error(`size-gate: the scope names ${missing.join(', ')}, which ${root} doesn't have.`);
}

/** Every file the repository holds that the scope covers, as a path from the root with forward slashes. */
function scopeFiles(root: string, scope: SizeScope): string[] {
  existing(root, [...scope.dirs, ...scope.files]);
  const covered = (file: string): boolean => !skipped(file, scope.skip)
    && (scope.files.includes(file) || scope.dirs.some(dir => inside(dir, file)));
  return repositoryFiles(root, scope.extensions).filter(covered).sort();
}

/** The numbers of every file in scope, by path. */
export function measureScope(root: string, scope: SizeScope): Map<string, FileMeasurement> {
  const read = (file: string): FileMeasurement => {
    const measured = measureWorking(root, file);
    if (!measured) throw new Error(`size-gate: ${file} is gone from ${root}.`);
    return measured;
  };
  return new Map(scopeFiles(root, scope).map(file => [file, read(file)]));
}
