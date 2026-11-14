// A throwaway repository for the gate tests: the committed gate configs, and source each test writes to break or
// satisfy a gate. The gate runs as its committed npm script, with that script's paths resolved against this repository.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelIsRecord } from '../src/react/preview3d/recordModel.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONFIGS = ['.dependency-cruiser.json', '.jscpd.json', 'tsconfig.json'];
const COLOR = /\x1b\[[0-9;]*m/g;

/** The committed command of an npm script, its repository paths made absolute so it runs from another directory. */
function committed(script: string): string[] {
  const manifest: unknown = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const command = modelIsRecord(manifest) && modelIsRecord(manifest.scripts) ? manifest.scripts[script] : undefined;
  if (typeof command !== 'string') throw new Error(`gate fixture: package.json has no ${script} script.`);
  return command.split(' ').map(arg => arg.startsWith('scripts/') ? path.join(ROOT, arg) : arg);
}

export type GateRun = { status: number | null; output: string };

/** Writes `files` beside the committed configs in a fresh directory, and runs `script` there with `env`. */
export function runGate(script: string, files: Record<string, string>, env: NodeJS.ProcessEnv): GateRun {
  const dir = mkdtempSync(path.join(tmpdir(), 'gate-fixture-'));
  try {
    CONFIGS.forEach(config => copyFileSync(path.join(ROOT, config), path.join(dir, config)));
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), text);
    }
    const [program, ...args] = committed(script);
    const run = spawnSync(program, args, { cwd: dir, env, encoding: 'utf8' });
    if (run.error) throw new Error(`gate fixture: ${script} did not run (${run.error.message}); npm run gate-tools.`);
    return { status: run.status, output: `${run.stdout}${run.stderr}`.replace(COLOR, '') };
  } finally {
    rmSync(dir, { recursive: true });
  }
}
