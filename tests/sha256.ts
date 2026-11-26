import {type BinaryLike, createHash} from 'node:crypto';

/** The hex sha256 of `bytes`: the digest a description states for a file or program it names. */
export const sha256 = (bytes: BinaryLike) => createHash('sha256').update(bytes).digest('hex');
