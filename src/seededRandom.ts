/** A repeatable stand-in for `Math.random` (mulberry32): the same `seed` draws the same sequence in [0, 1) every run,
 * for what must scatter the same way each time and for a test that must reproduce a draw. */
export function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
