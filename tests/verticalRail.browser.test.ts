// A vertical joined control is a rail: its rows divide with a rule across and draw no rule down their inline start,
// whether it takes one choice or several, and a closed rail has the same rule above its first row as below its last.
// Read in Chromium from verticalRailScene.tsx.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {RAIL_OPTIONS,RailLabel} from './verticalRailCases.ts';

const page=await openScene('tests/verticalRailScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);

for(const label of Object.values(RailLabel))test(`the ${label}`,async()=>{
 const rail=page.getByRole('group',{name:label});
 await rail.waitFor();
 const rows=await rail.locator('button').evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node);
  return {inlineStart:s.borderInlineStartWidth,blockStart:`${s.borderBlockStartWidth} ${s.borderBlockStartColor}`,
   blockEnd:`${s.borderBlockEndWidth} ${s.borderBlockEndColor}`};}));
 assert.equal(rows.length,RAIL_OPTIONS.length);
 const rule=rows[0].blockStart;
 assert.notEqual(parseFloat(rule),0,'the first row has no rule above it');
 assert.deepEqual(rows.map(row=>row.inlineStart),rows.map(()=>'0px'),'a row draws a rule down its inline start');
 assert.deepEqual(rows.map(row=>row.blockStart),rows.map(()=>rule),'the rows divide with different rules');
 assert.equal(rows[rows.length-1].blockEnd,rule,'the last row\'s rule below differs from the first row\'s above');
});
