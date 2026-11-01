import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTICIPANT_GRASS,growParticipantGrass} from '../src/react/participantGrass.ts';

// A repeatable stand-in for Math.random, so a failing field can be reproduced.
const seeded=(seed:number)=>()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};

test('grass reaches the full width at its planted spacing',()=>{
 const blades=growParticipantGrass([],640,seeded(1));
 assert.ok(blades.at(-1)!.x>=640);
 blades.forEach((blade,index)=>{
  const gap=blade.x-(blades[index-1]?.x??0);
  assert.ok(gap>=PARTICIPANT_GRASS.gap[0]-.01&&gap<=PARTICIPANT_GRASS.gap[1]+.01,`gap ${gap}`);
  assert.ok(Number.isInteger(blade.variant)&&blade.variant>=0&&blade.variant<PARTICIPANT_GRASS.variants);
 });
});
test('each planting differs',()=>{
 const paths=(seed:number)=>growParticipantGrass([],200,seeded(seed)).map(blade=>blade.path);
 assert.notDeepEqual(paths(1),paths(2));
});
test('resizing keeps what is already growing',()=>{
 const random=seeded(3),small=growParticipantGrass([],200,random),large=growParticipantGrass(small,400,random);
 assert.deepEqual(large.slice(0,small.length),small);
 assert.ok(large.at(-1)!.x>=400);
 assert.equal(growParticipantGrass(large,100,random),large);
});
