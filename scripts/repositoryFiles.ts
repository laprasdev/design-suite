// The files the repository holds: what git tracks or would track, as it stands in the working tree, from `root` down.
// A folder is left out only because .gitignore ignores it, never by its name. Every gate reads its files here.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

const gitCommand = (args: readonly string[]): string => `git ${args.join(' ')}`;

/** `git <args>` run in `root`; throws, naming the command, when git does not start. */
function gitRun(root: string, args: readonly string[]): SpawnSyncReturns<string> {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw new Error(`${gitCommand(args)} failed to start in ${root} (${result.error.message}).`);
  return result;
}

/** What `git <args>` prints in `root`; throws, naming the command and what git said, when it fails. */
export function gitOutput(root: string, args: readonly string[]): string {
  const { status, stdout, stderr } = gitRun(root, args);
  if (status !== 0) throw new Error(`${gitCommand(args)} failed in ${root}:\n${stderr.trim()}`);
  return stdout;
}

/** Whether `git <args>` succeeds in `root`, for a question git answers by its exit status. */
export const gitSucceeds = (root: string, args: readonly string[]): boolean => gitRun(root, args).status === 0;

const listed = (root: string, flags: readonly string[]): string[] =>
  gitOutput(root, ['ls-files', '-z', ...flags]).split('\0').filter(file => file.length > 0);

/** Every file the repository holds whose name ends in one of `extensions`, as a path from `root`. */
export function repositoryFiles(root: string, extensions: readonly string[]): string[] {
  const deleted = new Set(listed(root, ['--deleted']));
  return listed(root, ['--cached', '--others', '--exclude-standard'])
    .filter(file => !deleted.has(file) && extensions.some(extension => file.endsWith(extension)));
}
