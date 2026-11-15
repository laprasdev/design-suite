// The TypeScript gate: zero JavaScript modules or declaration sidecars, every TypeScript module in the repository
// covered by tsconfig.repo.json under strict settings, zero explicit `any` or compiler suppression comments, and a
// clean type check.
//   node scripts/type-gate.ts
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from './gateTools/node_modules/typescript/lib/typescript.js';
import { isRecord } from '../src/valueChecks.ts';

const TSC = fileURLToPath(new URL('../node_modules/.bin/tsc', import.meta.url));
const CONFIG = 'tsconfig.repo.json';
const SKIP_DIRS: ReadonlySet<string> = new Set(['.git', 'node_modules', 'dist', '.local']);
const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs'] as const;
const SIDECAR_EXTENSIONS = ['.d.mts', '.d.cts'] as const;
const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'] as const;
const SUPPRESSION = /@ts-(?:ignore|nocheck|expect-error)\b/;
const REQUIRED_TRUE = ['strict', 'noEmit', 'erasableSyntaxOnly', 'verbatimModuleSyntax'] as const;

const failGate = (reason: string): never => {
  throw new Error(`type gate: ${reason}`);
};

function runTsc(root: string, args: readonly string[]): { status: number; output: string } {
  const result = spawnSync(TSC, ['-p', CONFIG, ...args], { cwd: root, encoding: 'utf8' });
  if (result.error) return failGate(`tsc failed to start (${result.error.message}).`);
  const status = result.status ?? failGate(`tsc terminated on signal ${result.signal}.`);
  return { status, output: `${result.stdout}${result.stderr}` };
}

function scanDirectory(root: string, relDir: string, out: string[]): void {
  const entries = readdirSync(path.join(root, relDir), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) scanDirectory(root, relPath, out);
    else if (entry.isFile()) out.push(relPath);
  }
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
  if (relPath.endsWith('.d.ts') && !isModuleAugmentationFile(sourceFile)) {
    issues.push(`${relPath}: declaration sidecar; declare types in a .ts module.`);
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

function readCoveredFiles(root: string): Set<string> {
  const configPath = path.join(root, CONFIG);
  if (!existsSync(configPath)) return failGate(`missing ${CONFIG}.`);
  const rawConfig: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!isRecord(rawConfig)) return failGate(`${CONFIG} must be a JSON object.`);
  if (Object.hasOwn(rawConfig, 'exclude')) return failGate(`${CONFIG} must not declare exclude.`);
  const shown = runTsc(root, ['--showConfig']);
  if (shown.status !== 0) return failGate(`${CONFIG} failed --showConfig:\n${shown.output.trim()}`);
  const parsed: unknown = JSON.parse(shown.output);
  if (!isRecord(parsed) || !isRecord(parsed.compilerOptions) || !Array.isArray(parsed.files)) {
    return failGate(`${CONFIG} --showConfig returned invalid compilerOptions or files.`);
  }
  if (Object.hasOwn(parsed, 'exclude')) return failGate(`${CONFIG} effective config must not declare exclude.`);
  for (const flag of REQUIRED_TRUE) {
    if (parsed.compilerOptions[flag] !== true) return failGate(`${CONFIG} must hold ${flag}: true.`);
  }
  if (parsed.compilerOptions.allowJs !== false) return failGate(`${CONFIG} must hold allowJs: false.`);
  const files = parsed.files.filter((item): item is string => typeof item === 'string');
  return new Set(files.map(file => path.resolve(root, file)));
}

const root = process.cwd();
const allFiles: string[] = [];
scanDirectory(root, '', allFiles);
const problems: string[] = [];
const tsFiles: string[] = [];
for (const file of allFiles) {
  if (JS_EXTENSIONS.some(ext => file.endsWith(ext))) {
    problems.push(`${file}: JavaScript module; convert to TypeScript.`);
  } else if (SIDECAR_EXTENSIONS.some(ext => file.endsWith(ext))) {
    problems.push(`${file}: declaration sidecar; declare types in a .ts module.`);
  } else if (TS_EXTENSIONS.some(ext => file.endsWith(ext))) {
    tsFiles.push(file);
  }
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
