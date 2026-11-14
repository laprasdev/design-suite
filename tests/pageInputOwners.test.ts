// What listens for keys and presses on the page itself (the document, the window or the global object), and what names
// Escape, read from the source. A key on the page has one owner, pageKeys, which orders who hears it; every other
// reader, from Space held to pan to a Modal's Escape, hears it through pageKeys. Each press has the owner of its
// concept. Nothing else listens for either, so a second copy, a popover closing itself or a control cancelling its own
// drag, fails here.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {it} from 'node:test';
import {SUITE_ROOT} from './bundled.ts';

const MODAL_DISMISSAL='src/react/modalDismissal.ts',CONTROL_CANCEL='src/react/controlCancel.ts';
const KEY_OWNER='src/react/pageKeys.ts';
const PRESS_OWNERS: Readonly<Record<string,string>>={
 'how an open Modal is dismissed':MODAL_DISMISSAL,
 'a drag from its press to its end':'src/react/useDragSession.ts',
};
const NAMES_ESCAPE=/['"]Escape['"]/;
// A listener on the page names its receiver (the document, its body or root element, the window or the global object)
// or none, and its event literally.
const PAGE=String.raw`document\.body|document\.documentElement|document|window|globalThis|self`;
const listensOnThePage=(events: readonly string[])=>new RegExp(String.raw`(?<![\w.])(?:(?:${PAGE})\.)?`
 +String.raw`addEventListener\(\s*['"](?:${events.join('|')})['"]`);
const KEYS=listensOnThePage(['key(?:down|up|press)']);
const PRESSES=listensOnThePage(['(?:pointer|mouse|touch)(?:down|up|start|end)','(?:dbl|aux)?click','contextmenu']);

it('gives a key on the page one owner, each press the owner of its concept, and Escape two',()=>{
 const sources=readdirSync(join(SUITE_ROOT,'src'),{recursive:true,encoding:'utf8'})
  .filter(file=>/\.tsx?$/.test(file)).map(file=>`src/${file}`);
 const read=(file: string)=>readFileSync(join(SUITE_ROOT,file),'utf8');
 const listening=(listens: RegExp)=>sources.filter(file=>listens.test(read(file))).sort();
 assert.deepEqual(listening(KEYS),[KEY_OWNER],'a key on the page is heard through pageKeys');
 assert.deepEqual(listening(PRESSES),Object.values(PRESS_OWNERS).sort(),
  'a press on the page belongs to the owner of its concept');
 assert.deepEqual(sources.filter(file=>NAMES_ESCAPE.test(read(file))).sort(),[CONTROL_CANCEL,MODAL_DISMISSAL],
  'Escape dismisses a Modal or cancels what a control is doing, and only those owners name it');
});
