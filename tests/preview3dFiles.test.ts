import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {MODEL_FILE_TEXT, readModelFile} from '../src/react/preview3d/files.ts';
import {sha256} from './sha256.ts';


describe('the stage\'s file read', () => {
  it('reads a file the description names only when its bytes have the stated SHA-256', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = async () => new Response('texels');
    try {
      const signal = new AbortController().signal;
      assert.equal(new TextDecoder().decode(await readModelFile('/a.png', sha256('texels'), signal)), 'texels');
      await assert.rejects(readModelFile('/a.png', sha256('other'), signal),
        new RegExp(MODEL_FILE_TEXT.digest('/a.png', sha256('other'), sha256('texels'))));
      globalThis.fetch = async () => new Response('', {status: 404});
      await assert.rejects(readModelFile('/a.png', sha256('texels'), signal), /\/a.png could not be read \(HTTP 404\)/);
    } finally {
      globalThis.fetch = real;
    }
  });
});
