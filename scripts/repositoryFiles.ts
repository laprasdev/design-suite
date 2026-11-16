// The files the repository holds: what git tracks or would track, as it stands in the working tree, from `root` down.
// A folder is left out only because .gitignore ignores it, never by its name. Every gate reads its files here.
import { spawnSync } from 'node:child_process';

/** What `git <args>` prints in `root`; throws, naming the command and what git said, when it fails. */
export function gitOutput(root: string, args: readonly string[]): string {
  const command = `git ${args.join(' ')}`;
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw new Error(`${command} failed to start in ${root} (${result.error.message}).`);
  if (result.status !== 0) throw new Error(`${command} failed in ${root}:\n${result.stderr.trim()}`);
  return result.stdout;
}

const listed = (root: string, flags: readonly string[]): string[] =>
  gitOutput(root, ['ls-files', '-z', ...flags]).split('\0').filter(file => file.length > 0);

/** Every file the repository holds whose name ends in one of `extensions`, as a path from `root`. */
export function repositoryFiles(root: string, extensions: readonly string[]): string[] {
  const deleted = new Set(listed(root, ['--deleted']));
  return listed(root, ['--cached', '--others', '--exclude-standard'])
    .filter(file => !deleted.has(file) && extensions.some(extension => file.endsWith(extension)));
}
