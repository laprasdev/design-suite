// The stage's one way to read a file the description names by path and SHA-256: whole, verified and abortable.
export const MODEL_FILE_TEXT = Object.freeze({
  unread: (path: string, status: number) => `${path} could not be read (HTTP ${status}).`,
  digest: (path: string, expected: string, actual: string) =>
    `${path} does not match its stated SHA-256: expected ${expected}, read ${actual}.`,
});
/** A file the description names by path and SHA-256: read whole, and refused unless its bytes have that digest. */
export async function readModelFile(path: string, sha256: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(path, {signal});
  if (!response.ok) throw new Error(MODEL_FILE_TEXT.unread(path, response.status));
  const bytes = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== sha256) throw new Error(MODEL_FILE_TEXT.digest(path, sha256, actual));
  signal.throwIfAborted();
  return bytes;
}
export type ModelFileReader = typeof readModelFile;
