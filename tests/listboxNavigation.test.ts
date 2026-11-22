// The moves through a list (listMoves), and a listbox's arrows (the vertical ones, which also open it): along each
// orientation its arrows step back and on, stopping at the ends or, `wraps`, coming round to the other end; Home and
// End reach the ends; and from no active option (NO_ACTIVE, as a tab list whose chosen option is disabled) the arrows
// enter the list, on at its first option and back at its last.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LISTBOX_ARROWS,LISTBOX_MOVES,LISTBOX_OPENS,listMoves,NO_ACTIVE,type ListOrientation}
 from '../src/react/listboxNavigation.ts';

const COUNT=4,LAST=COUNT-1;
// Each orientation's arrows, which the other orientation's moves leave alone.
const ARROWS: readonly {orientation: ListOrientation,back: string,next: string}[]=Object.freeze([
 {orientation:'vertical',back:'ArrowUp',next:'ArrowDown'},
 {orientation:'horizontal',back:'ArrowLeft',next:'ArrowRight'}]);
// Each move, from an active option, to the option it reaches when the list stops at its ends and when it wraps.
interface MoveCase {key: 'back'|'next'|'Home'|'End'; from: number; stops: number; wraps: number}
const CASES: readonly MoveCase[]=Object.freeze([
 {key:'next',from:1,stops:2,wraps:2},{key:'back',from:1,stops:0,wraps:0},
 {key:'next',from:LAST,stops:LAST,wraps:0},{key:'back',from:0,stops:0,wraps:LAST},
 {key:'Home',from:2,stops:0,wraps:0},{key:'End',from:1,stops:LAST,wraps:LAST},
 {key:'next',from:NO_ACTIVE,stops:0,wraps:0},{key:'back',from:NO_ACTIVE,stops:LAST,wraps:LAST},
]);

for(const arrows of ARROWS)for(const wraps of [false,true])
 test(`${arrows.orientation} moves that ${wraps?'wrap':'stop'} at the ends`,()=>{
  const moves=listMoves(arrows.orientation,wraps);
  for(const {key,from,...reached} of CASES){
   const name=key==='back'||key==='next'?arrows[key]:key;
   assert.equal(moves[name](from,COUNT),wraps?reached.wraps:reached.stops,`${name} from ${from}`);
  }
  for(const across of ARROWS.filter(other=>other!==arrows)){
   assert.equal(moves[across.back],undefined);
   assert.equal(moves[across.next],undefined);
  }
 });

test('a listbox\'s arrows are the vertical ones, and each moves through it and opens it on its chosen option',()=>{
 const [vertical]=ARROWS.filter(arrows=>arrows.orientation==='vertical');
 assert.deepEqual([...LISTBOX_ARROWS].sort(),[vertical.back,vertical.next].sort());
 for(const key of LISTBOX_ARROWS){
  assert.ok(LISTBOX_MOVES[key],key);
  assert.equal(LISTBOX_OPENS[key]?.(1,COUNT),1,key);
 }
});
