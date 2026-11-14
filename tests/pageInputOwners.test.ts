// What listens for keys and presses on the page itself (the document, the window or the global object), and what names
// Escape, read from the source. Each such concept has one owner and nothing else listens for it, so a second copy, a
// popover closing itself or a control cancelling its own drag, fails here. What reads a key on the page, from Space
// held to pan to Escape cancelling a drag, hears it through pageKeys.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {it} from 'node:test';
import {SUITE_ROOT} from './bundled.ts';

const MODAL_DISMISSAL='src/react/modalDismissal.ts',CONTROL_CANCEL='src/react/controlCancel.ts';
const OWNERS: Readonly<Record<string,string>>={
 'how an open Modal is dismissed':MODAL_DISMISSAL,
 'a drag from its press to its end':'src/react/useDragSession.ts',
 'a key going down or up on the page':'src/react/pageKeys.ts',
};
const NAMES_ESCAPE=/['"]Escape['"]/;
// A listener on the page names its receiver (the document, its body or root element, the window or the global object)
// or none, and its event literally.
const PAGE=String.raw`document\.body|document\.documentElement|document|window|globalThis|self`;
const KEYS_AND_PRESSES=['key(?:down|up|press)','(?:pointer|mouse|touch)(?:down|up|start|end)','(?:dbl|aux)?click',
 'contextmenu'].join('|');
const LISTENS_ON_THE_PAGE=new RegExp(String.raw`(?<![\w.])(?:(?:${PAGE})\.)?addEventListener\(\s*`
 +`['"](?:${KEYS_AND_PRESSES})['"]`);

it('gives every key and press listened for on the page one owner per concept, and Escape two',()=>{
 const sources=readdirSync(join(SUITE_ROOT,'src'),{recursive:true,encoding:'utf8'})
  .filter(file=>/\.tsx?$/.test(file)).map(file=>`src/${file}`);
 const read=(file: string)=>readFileSync(join(SUITE_ROOT,file),'utf8');
 assert.deepEqual(sources.filter(file=>LISTENS_ON_THE_PAGE.test(read(file))).sort(),Object.values(OWNERS).sort(),
  'a key or press on the page belongs to the owner of its concept');
 assert.deepEqual(sources.filter(file=>NAMES_ESCAPE.test(read(file))).sort(),[CONTROL_CANCEL,MODAL_DISMISSAL],
  'Escape dismisses a Modal or cancels what a control is doing, and only those owners name it');
});
