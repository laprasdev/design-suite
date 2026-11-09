import test from 'node:test';
import assert from 'node:assert/strict';
import {pageStackDirection,pageStackKeys} from '../src/react/pageStack.ts';
import {pageFrames,PAGE_FADE,PAGE_FADE_IN,PAGE_FADE_OUT} from '../src/react/pageMotion.ts';
import {PAGE_MOTION} from '../src/react/motion.ts';

test('a retained prefix pushes forward and pops back, including several pages at once',()=>{
 const root=['list'],detail=[...root,'detail'],editing=[...detail,'edit'];
 assert.equal(pageStackDirection(root,detail),1);
 assert.equal(pageStackDirection(root,editing),1);
 assert.equal(pageStackDirection(editing,detail),-1);
 assert.equal(pageStackDirection(editing,root),-1);
});

test('unrelated or same-depth replacements fade instead of inventing a back direction',()=>{
 const root=['list'];
 assert.equal(pageStackDirection(root,root),0);
 assert.equal(pageStackDirection(['list','detail'],['list','other']),0);
 assert.equal(pageStackDirection(['list','detail'],['search']),0);
 assert.equal(pageStackDirection([],root),0);
 assert.equal(pageStackDirection(root,[]),0);
});

test('page identity comes from stable unique keys, not node identity',()=>{
 assert.deepEqual(pageStackKeys([{key:'list',node:null},{key:'detail',node:'current'}]),['list','detail']);
 assert.throws(()=>pageStackKeys([{key:'same',node:null},{key:'same',node:null}]),/unique/);
});

test('forward pages enter from the right and Back reverses the same motion',()=>{
 const forward=pageFrames(1),back=pageFrames(-1);
 assert.deepEqual(forward.incoming[0],[{transform:'translateX(100%)',opacity:0},
  {transform:'translateX(0)',opacity:1}]);
 assert.deepEqual(forward.outgoing[0],[{transform:'translateX(0)',opacity:1},
  {transform:'translateX(-100%)',opacity:0}]);
 assert.deepEqual(back.incoming[0],[{transform:'translateX(-100%)',opacity:0},
  {transform:'translateX(0)',opacity:1}]);
 assert.equal(forward.incoming[1],PAGE_MOTION);
 assert.equal(back.outgoing[1],PAGE_MOTION);
});

test('replacement finishes fading out before the incoming half begins',()=>{
 const replacement=pageFrames(0);
 assert.deepEqual(replacement.outgoing,[PAGE_FADE_OUT,PAGE_FADE]);
 assert.deepEqual(replacement.incoming,[PAGE_FADE_IN,{...PAGE_FADE,delay:PAGE_FADE.duration}]);
 assert.equal(replacement.incoming[1].delay!+replacement.incoming[1].duration,PAGE_MOTION.duration);
});
