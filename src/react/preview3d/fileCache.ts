import type {ModelFileReader} from './files.ts';
import type {ModelSurfaceFile} from './surfaceModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// The stage's one cache of files a description names by SHA-256: each read once (verified, files.ts) and decoded
// once. A staged load is an attempt: it waits on the files it names, and releases them when it is shown, refused or
// superseded. A read no attempt waits on any more is aborted. A held file stays while the description in force names it
// or something drawn uses it; every other is freed (a decoded image closed) as soon as nothing waits on it.
export const MODEL_FILE_CACHE_TEXT = Object.freeze({
  unloaded: (path: string) => `${path} was asked for before the staged load read it.`,
  failed: (what: string, file: ModelSurfaceFile, why: string) =>
    `The ${what} ${file.path} (SHA-256 ${file.sha256}) could not be loaded: ${why}`,
});
/** What one staged load waits on, and how it lets go of what it waited on. */
export interface ModelStagedLoad {readonly pending: readonly Promise<void>[]; release(): void}
export interface ModelFileCacheKind<T> {
  /** What the cache holds, as a refusal names it: "texture", "web program". */
  readonly what: string;
  readonly decode: (bytes: ArrayBuffer) => Promise<T>;
  /** Frees a decoded value the cache drops. */
  readonly free: (value: T) => void;
  /** Whether something drawn still uses a value, so it is kept although no description names it. */
  readonly used: (value: T) => boolean;
}

export function createModelFileCache<T>(read: ModelFileReader, kind: ModelFileCacheKind<T>) {
  const held = new Map<string, T>(), wanted = new Map<string, number>();
  const flying = new Map<string, {readonly done: Promise<void>; readonly controller: AbortController}>();
  let inForce = new Set<string>();
  const drop = (sha256: string) => {
    const value = held.get(sha256);
    if (value === undefined || inForce.has(sha256) || wanted.has(sha256) || kind.used(value)) return;
    held.delete(sha256);
    kind.free(value);
  };
  const start = (file: ModelSurfaceFile) => {
    const controller = new AbortController();
    const done: Promise<void> = read(file.path, file.sha256, controller.signal).then(kind.decode).then(value => {
      // A read let go of can still land (its bytes were whole before the abort): a file held again keeps one copy.
      if (held.has(file.sha256)) kind.free(value);
      else held.set(file.sha256, value);
      drop(file.sha256);
    }, (error: unknown) => {
      throw new ModelStageRefusal(MODEL_FILE_CACHE_TEXT.failed(kind.what, file,
        error instanceof Error ? error.message : String(error)), {cause: error});
    }).finally(() => {
      if (flying.get(file.sha256)?.done === done) flying.delete(file.sha256);
    });
    flying.set(file.sha256, {done, controller});
    return done;
  };
  return {
    /** A staged load of these files: it waits on each one not held, read once while in flight, and counts every one
     * it names, held or not, so that letting go of an earlier load never frees a file a later one names. */
    load(files: Iterable<ModelSurfaceFile>): ModelStagedLoad {
      const named = new Map([...files].map(file => [file.sha256, file]));
      for (const sha256 of named.keys()) wanted.set(sha256, (wanted.get(sha256) ?? 0) + 1);
      const pending = [...named.values()].filter(file => !held.has(file.sha256))
        .map(file => flying.get(file.sha256)?.done ?? start(file));
      let released = false;
      return {pending, release() {
        if (released) return;
        released = true;
        for (const sha256 of named.keys()) {
          const left = wanted.get(sha256)! - 1;
          if (left > 0) {wanted.set(sha256, left); continue;}
          wanted.delete(sha256);
          // Aborted and forgotten at once: a later load of the same file starts its own read.
          flying.get(sha256)?.controller.abort();
          flying.delete(sha256);
          drop(sha256);
        }
      }};
    },
    /** A file the staged load read; asking for one it did not read is a defect of the caller, never a refusal. */
    get(file: ModelSurfaceFile): T {
      const value = held.get(file.sha256);
      if (value === undefined) throw new Error(MODEL_FILE_CACHE_TEXT.unloaded(file.path));
      return value;
    },
    /** The description in force names these files: they stay, and every other held file nothing uses is freed. */
    keep(files: Iterable<ModelSurfaceFile>) {
      inForce = new Set([...files].map(file => file.sha256));
      for (const sha256 of [...held.keys()]) drop(sha256);
    },
    dispose() {
      for (const {controller} of flying.values()) controller.abort();
      for (const value of held.values()) kind.free(value);
      held.clear();
      inForce = new Set();
    },
  };
}
export type ModelFileCache<T> = ReturnType<typeof createModelFileCache<T>>;
