import assert from 'node:assert/strict';
import {test} from 'node:test';
import {progressWeights} from '../src/react/inputs/progressWeights.ts';

test('fractional, integer and single weights fill the same complete distribution', () => {
 assert.deepEqual(progressWeights([2,3]), [.4,.6000000000000001]);
 const fraction=progressWeights([.2,.3]);
 assert.ok(Math.abs(fraction[0]!-.4)<Number.EPSILON);
 assert.ok(Math.abs(fraction[1]!-.6)<Number.EPSILON);
 assert.deepEqual(progressWeights([0,.2,0]), [0,1,0]);
});
test('empty and zero distributions stay empty; large finite values preserve their proportions', () => {
 assert.deepEqual(progressWeights([]), []);
 assert.deepEqual(progressWeights([0,0]), [0,0]);
 assert.deepEqual(progressWeights([Number.MAX_VALUE,Number.MAX_VALUE]), [.5,.5]);
});
test('invalid progress weights fail loudly', () => {
 for(const value of [-1,Infinity,NaN]) assert.throws(()=>progressWeights([value]), /nonnegative finite/);
});
