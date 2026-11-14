// The source check a Modal's consumers run (src/react/modalInputCheck.ts): it refuses a Modal property declared in a
// stylesheet or a module, naming the line and the prop to pass, and passes a property read, a comment and a theme's
// width token. The suite's own sources declare none outside the Modal's files.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {modalInputFailures} from '../src/react/modalInputCheck.ts';
import {SUITE_ROOT} from './bundled.ts';

// The Modal's own files, which set its properties, and the sources the suite holds to the check.
const MODAL_OWNERS=new Set(['src/react/Modal.tsx','src/react/portraits-modal.css']);
const CHECKED=Object.freeze({directories:['src','examples'],extensions:/\.(?:css|[jt]sx?)$/});
const FIXTURE='fixture';

test('refuses a consumer declaring the Modal\'s width or frame inset, naming the line and the prop to pass',()=>{
 assert.deepEqual(modalInputFailures('.lesson-message {\n --sd-modal-width:520px;\n}',FIXTURE),
  [`${FIXTURE}:2: --sd-modal-width belongs to Modal; pass its \`width\` prop instead.`]);
 assert.deepEqual(modalInputFailures('.lesson-overlay { --modal-frame-inset:var(--message-inset); }',FIXTURE),
  [`${FIXTURE}:1: --modal-frame-inset belongs to Modal; pass its \`frameInset\` prop instead.`]);
 assert.deepEqual(modalInputFailures('.x { --sd-modal-radius:0; }',FIXTURE),
  [`${FIXTURE}:1: --sd-modal-radius belongs to Modal; no consumer declares it.`]);
 for(const source of [
  '.player-event-animation{--sd-modal-width:calc(var(--control-hit-size) * 24);display:flex}',
  '.placed { --sd-modal-width : min(520px,100%); }',
  '.frame { --sd-modal-frame-inset:12px; }',
  "<Modal open style={{'--sd-modal-width':'520px'}}/>",
  'const style={["--sd-modal-width"]:width};',
  "panel.style.setProperty('--sd-modal-width', '520px');",
 ])assert.equal(modalInputFailures(source,FIXTURE).length,1,source);
});
test('passes a Modal property read, a comment naming one, its width prop and a theme\'s width token',()=>{
 for(const source of [
  '.x { width:var(--sd-modal-width);max-width:min(var(--sd-modal-width,1px),100%); }',
  '/* A consumer once set --sd-modal-width: 520px here. */',
  '<Modal open placement={ModalPlacement.CONTAINED} width={ModalWidth.READING} frameInset={ModalFrameInset.GUTTER}/>',
  ':root { --modal-width-reading:560px; }',
 ])assert.deepEqual(modalInputFailures(source,FIXTURE),[],source);
});
test('the suite declares no Modal property outside the Modal\'s own files',()=>{
 const sources=CHECKED.directories.flatMap(directory=>readdirSync(join(SUITE_ROOT,directory),
  {recursive:true,encoding:'utf8'}).map(file=>join(directory,file)))
  .filter(file=>CHECKED.extensions.test(file)&&!MODAL_OWNERS.has(file));
 assert.ok(sources.length,'the check reads the suite\'s sources');
 assert.deepEqual(sources.flatMap(file=>modalInputFailures(readFileSync(join(SUITE_ROOT,file),'utf8'),file)),[]);
});
