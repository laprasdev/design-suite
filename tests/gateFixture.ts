// A throwaway git repository for the gate tests: the gate configs and .gitignore, and the files each test writes to
// break or satisfy a gate. The configs and the tree's `base` files are committed as origin/main, the branch a gate
// compares with, and its `head` files are written over them. A gate runs there through its own entry point, as its npm
// script runs it from the repository root.
// The directory sits under a .local directory, as a worktree of this repository does, so a gate that matched its
// ignore patterns against absolute paths would skip every file and pass.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONFIGS = [
  '.dependency-cruiser.json', '.gitignore', '.jscpd.json', 'package.json', 'tsconfig.json', 'tsconfig.repo.json',
  'scripts/size-baseline.json',
];
const COLOR = /\x1b\[[0-9;]*m/g;

/** The entry point of each gate: npm run check:types, check:cycles and check:duplication run these, with no args. */
export const GATE = {
  types: [process.execPath, path.join(ROOT, 'scripts/type-gate.ts')],
  cycles: [process.execPath, path.join(ROOT, 'scripts/cycle-gate.ts')],
  duplication: [path.join(ROOT, 'scripts/gateTools/node_modules/.bin/jscpd')],
  baselines: [process.execPath, path.join(ROOT, 'scripts/baseline-gate.ts')],
} as const;

export type GateRun = { status: number | null; output: string };
/** The files committed as origin/main, and the files written over them in the working tree. */
export type GateTree = { readonly base: Record<string, string>; readonly head: Record<string, string> };

/** A commit that reads no global identity, signing or hooks of the machine it runs on. */
const COMMIT_CONFIG = [
  'user.name=gate fixture', 'user.email=gate-fixture@localhost', 'commit.gpgsign=false', 'core.hooksPath=/dev/null',
].flatMap(setting => ['-c', setting]);

function git(dir: string, args: readonly string[]): void {
  const run = spawnSync('git', [...COMMIT_CONFIG, '-C', dir, ...args], { encoding: 'utf8' });
  if (run.status === 0) return;
  throw new Error(`gate fixture: git ${args.join(' ')} failed (${run.error?.message ?? run.stderr}).`);
}

function write(dir: string, files: Record<string, string>): void {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  }
}

/** Builds `tree` beside the configs in a fresh repository, and runs `gate` there with `env`. */
export function runGate(gate: readonly string[], tree: GateTree, env: NodeJS.ProcessEnv): GateRun {
  const scratch = mkdtempSync(path.join(tmpdir(), 'gate-fixture-'));
  const dir = path.join(scratch, '.local', 'repository');
  try {
    mkdirSync(dir, { recursive: true });
    git(dir, ['init', '--quiet']);
    symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    for (const config of CONFIGS) {
      mkdirSync(path.dirname(path.join(dir, config)), { recursive: true });
      copyFileSync(path.join(ROOT, config), path.join(dir, config));
    }
    write(dir, tree.base);
    git(dir, ['add', '--all']);
    git(dir, ['commit', '--quiet', '--message', 'base']);
    git(dir, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    write(dir, tree.head);
    const [program, ...args] = gate;
    const run = spawnSync(program, args, { cwd: dir, env, encoding: 'utf8' });
    if (run.error) throw new Error(`gate fixture: ${program} did not run (${run.error.message}); npm run gate-tools.`);
    return { status: run.status, output: `${run.stdout}${run.stderr}`.replace(COLOR, '') };
  } finally {
    rmSync(scratch, { recursive: true });
  }
}
