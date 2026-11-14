// A throwaway repository for the gate tests: the committed gate configs, and source each test writes to break or
// satisfy a gate. A gate runs there through its own entry point, as its npm script runs it from the repository root.
// The directory sits under a .local directory, as a worktree of this repository does, so a gate that matched its
// ignore patterns against absolute paths would skip every file and pass.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONFIGS = ['.dependency-cruiser.json', '.jscpd.json', 'tsconfig.json'];
const COLOR = /\x1b\[[0-9;]*m/g;

/** The entry point of each gate: npm run check:cycles and check:duplication run these, with no arguments. */
export const GATE = {
  cycles: [process.execPath, path.join(ROOT, 'scripts/cycle-gate.ts')],
  duplication: [path.join(ROOT, 'scripts/gateTools/node_modules/.bin/jscpd')],
} as const;

export type GateRun = { status: number | null; output: string };

/** Writes `files` beside the committed configs in a fresh directory, and runs `gate` there with `env`. */
export function runGate(gate: readonly string[], files: Record<string, string>, env: NodeJS.ProcessEnv): GateRun {
  const scratch = mkdtempSync(path.join(tmpdir(), 'gate-fixture-'));
  const dir = path.join(scratch, '.local', 'repository');
  try {
    mkdirSync(dir, { recursive: true });
    CONFIGS.forEach(config => copyFileSync(path.join(ROOT, config), path.join(dir, config)));
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), text);
    }
    const [program, ...args] = gate;
    const run = spawnSync(program, args, { cwd: dir, env, encoding: 'utf8' });
    if (run.error) throw new Error(`gate fixture: ${program} did not run (${run.error.message}); npm run gate-tools.`);
    return { status: run.status, output: `${run.stdout}${run.stderr}`.replace(COLOR, '') };
  } finally {
    rmSync(scratch, { recursive: true });
  }
}
