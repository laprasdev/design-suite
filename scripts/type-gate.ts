// The TypeScript gate: zero JavaScript modules, no declaration file but a module augmentation, every TypeScript
// module in the repository covered by tsconfig.repo.json under the required compiler options, zero explicit `any` or
// compiler suppression comments, and a clean type check.
//   node scripts/type-gate.ts
// `tsc` is the root's TypeScript 7, the compiler every check runs. TypeScript 7 ships no JavaScript compiler API, so
// the syntax inspection parses with the TypeScript 6 that scripts/gateTools pins beside dependency-cruiser.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from './gateTools/node_modules/typescript/lib/typescript.js';
import { isRecord, isStringList } from '../src/valueChecks.ts';
import { SUITE_BASELINE } from './size-gate.ts';
import { readBaseline } from './sizeGate/baselineFile.ts';
import { scopeFiles } from './sizeGate/measure.ts';

const TSC = fileURLToPath(new URL('../node_modules/.bin/tsc', import.meta.url));
const CONFIG = 'tsconfig.repo.json';
/** Under the root and outside any source: git's data and other worktrees. The size scope never walks the root. */
const OUTSIDE_SOURCE = ['.git', '.local'] as const;
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs'] as const;
const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'] as const;
const DECLARATION_FILE = /\.d\.[mc]?ts$/;
const SUPPRESSION = /@ts-(?:ignore|nocheck|expect-error)\b/;
/** The compiler options tsconfig.repo.json holds once its `extends` is resolved. */
const REQUIRED_OPTIONS = Object.freeze({
  strict: true, noEmit: true, erasableSyntaxOnly: true, verbatimModuleSyntax: true, allowJs: false,
} as const);

const failGate = (reason: string): never => {
  throw new Error(`type gate: ${reason}`);
};

function runTsc(root: string, args: readonly string[]): { status: number; output: string } {
  const result = spawnSync(TSC, ['-p', CONFIG, ...args], { cwd: root, encoding: 'utf8' });
  if (result.error) return failGate(`tsc failed to start (${result.error.message}).`);
  const status = result.status ?? failGate(`tsc terminated on signal ${result.signal}.`);
  return { status, output: `${result.stdout}${result.stderr}` };
}

/** Every JavaScript and TypeScript file under the root, skipping the directories the size scope skips. */
function repositoryFiles(root: string): string[] {
  const { skip } = readBaseline(path.join(root, SUITE_BASELINE)).scope;
  return scopeFiles(root, {
    dirs: ['.'],
    files: [],
    extensions: [...JS_EXTENSIONS, ...TS_EXTENSIONS],
    skip: { directories: [...skip.directories, ...OUTSIDE_SOURCE], suffixes: [] },
  });
}

function hasExportKeyword(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    && (ts.getModifiers(node)?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) ?? false);
}

function isExternalAugmentation(stmt: ts.Statement): boolean {
  return ts.isModuleDeclaration(stmt)
    && ts.isStringLiteral(stmt.name)
    && !stmt.name.text.startsWith('.')
    && !stmt.name.text.startsWith('/');
}

function isAllowedDeclarationStatement(stmt: ts.Statement): boolean {
  if (hasExportKeyword(stmt)) return false;
  if (isExternalAugmentation(stmt)) return true;
  return ts.isImportDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt);
}

function isModuleAugmentationFile(sourceFile: ts.SourceFile): boolean {
  return sourceFile.statements.some(isExternalAugmentation)
    && sourceFile.statements.every(isAllowedDeclarationStatement);
}

function lineAt(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

function inspectSyntax(relPath: string, text: string): string[] {
  const kind = relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, kind);
  const issues: string[] = [];
  if (DECLARATION_FILE.test(relPath) && !isModuleAugmentationFile(sourceFile)) {
    issues.push(`${relPath}: declaration file that augments no module; declare types in a .ts module.`);
  }
  const visitedComments = new Set<number>();
  const inspectComments = (pos: number): void => {
    const ranges = [
      ...(ts.getLeadingCommentRanges(text, pos) ?? []),
      ...(ts.getTrailingCommentRanges(text, pos) ?? []),
    ];
    for (const range of ranges) {
      if (visitedComments.has(range.pos)) continue;
      visitedComments.add(range.pos);
      if (SUPPRESSION.test(text.slice(range.pos, range.end))) {
        issues.push(`${relPath}:${lineAt(sourceFile, range.pos)}: compiler suppression comment.`);
      }
    }
  };
  const visit = (node: ts.Node): void => {
    inspectComments(node.pos);
    inspectComments(node.end);
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      issues.push(`${relPath}:${lineAt(sourceFile, node.getStart(sourceFile))}: explicit any.`);
    }
    for (const child of node.getChildren(sourceFile)) visit(child);
  };
  visit(sourceFile);
  return issues;
}

/** The files tsconfig.repo.json covers, from its effective configuration, which holds every required option. */
function readCoveredFiles(root: string): Set<string> {
  const shown = runTsc(root, ['--showConfig']);
  if (shown.status !== 0) return failGate(`${CONFIG} failed --showConfig:\n${shown.output.trim()}`);
  const parsed: unknown = JSON.parse(shown.output);
  if (!isRecord(parsed) || !isRecord(parsed.compilerOptions) || !isStringList(parsed.files)) {
    return failGate(`${CONFIG} --showConfig returned no compilerOptions record or files list.`);
  }
  for (const [option, value] of Object.entries(REQUIRED_OPTIONS)) {
    if (parsed.compilerOptions[option] !== value) failGate(`${CONFIG} must hold ${option}: ${value}.`);
  }
  return new Set(parsed.files.map(file => path.resolve(root, file)));
}

const root = process.cwd();
const problems: string[] = [];
const tsFiles: string[] = [];
for (const file of repositoryFiles(root)) {
  if (TS_EXTENSIONS.some(ext => file.endsWith(ext))) tsFiles.push(file);
  else problems.push(`${file}: JavaScript module; convert to TypeScript.`);
}
if (tsFiles.length === 0) failGate('found no TypeScript files.');
const covered = readCoveredFiles(root);
for (const file of tsFiles) {
  if (!covered.has(path.resolve(root, file))) problems.push(`${file}: not covered by ${CONFIG}.`);
  problems.push(...inspectSyntax(file, readFileSync(path.join(root, file), 'utf8')));
}
const typecheck = runTsc(root, ['--pretty', 'false']);
if (typecheck.status !== 0) problems.push(typecheck.output.trim());
if (problems.length > 0) {
  for (const problem of problems) console.error(`type gate: ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`type gate: ${tsFiles.length} TypeScript files checked, 0 JavaScript modules.`);
}
