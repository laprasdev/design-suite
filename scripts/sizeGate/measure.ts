// What the size gate reads of each file: its physical lines, the lines over the character limit, and the lines that
// belong to import statements, which a split may add to a file that imports what it moved.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
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

const skipped = (relative: string, skip: SizeSkip): boolean =>
  skip.suffixes.some(suffix => relative.endsWith(suffix)) || skip.directories.includes(path.posix.basename(relative));

function walk(root: string, dir: string, skip: SizeSkip): string[] {
  const at = path.join(root, dir);
  if (!existsSync(at)) throw new Error(`size-gate: the scope names ${dir}, which ${root} doesn't have.`);
  return readdirSync(at, { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(dir, entry.name);
    if (skipped(relative, skip)) return [];
    return entry.isDirectory() ? walk(root, relative, skip) : [relative];
  });
}

function listedFiles(root: string, files: readonly string[]): readonly string[] {
  const missing = files.filter(file => !existsSync(path.join(root, file)));
  if (missing.length) throw new Error(`size-gate: the scope names ${missing.join(', ')}, which ${root} doesn't have.`);
  return files;
}

/** Every file the scope covers, as a path from the root with forward slashes. */
function scopeFiles(root: string, scope: SizeScope): string[] {
  const walked = scope.dirs.flatMap(dir => walk(root, dir, scope.skip));
  const covered = (file: string): boolean =>
    scope.extensions.some(extension => file.endsWith(extension)) && !skipped(file, scope.skip);
  return [...listedFiles(root, scope.files), ...walked].filter(covered).sort();
}

/** The numbers of every file in scope, by path. */
export function measureScope(root: string, scope: SizeScope): Map<string, FileMeasurement> {
  const read = (file: string): FileMeasurement => measureText(readFileSync(path.join(root, file), 'utf8'));
  return new Map(scopeFiles(root, scope).map(file => [file, read(file)]));
}
