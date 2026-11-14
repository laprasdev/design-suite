import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {SUITE_ROOT} from './bundled.ts';
import {assertRefusesType,typeCheck} from './typeCheck.ts';

const declaration=readFileSync(join(SUITE_ROOT,'src/react/react-css.d.ts'),'utf8');
const previous="import 'react'; declare module 'react' {interface CSSProperties {"+
 "[custom: `--${string}`]:string|number|undefined}}";
const OPTIONS={strict:true,noEmit:true,module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022',types:['react']};

test('CSS custom properties merge across pinned and local suite copies without weakening value types',()=>{
 for(const other of [declaration,previous]) {
  assertRefusesType(value=>typeCheck({'first.d.ts':declaration,'second.d.ts':other,
   'usage.ts':`import type {CSSProperties} from 'react';const style:CSSProperties={'--tone':${value}}; void style;`},
  OPTIONS),"'pink'",'false');
 }
});
