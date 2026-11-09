import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const declaration=readFileSync(join(root,'src/react/react-css.d.ts'),'utf8');
const previous="import 'react'; declare module 'react' {interface CSSProperties {"+
 "[custom: `--${string}`]:string|number|undefined}}";

test('CSS custom properties merge across pinned and local suite copies without weakening value types',()=>{
 const dir=mkdtempSync(join(root,'.css-contract-'));
 try {
  const first=join(dir,'first.d.ts'),second=join(dir,'second.d.ts'),usage=join(dir,'usage.ts');
  writeFileSync(first,declaration);
  const config=join(dir,'tsconfig.json');
  writeFileSync(config,JSON.stringify({files:['first.d.ts','second.d.ts','usage.ts'],compilerOptions:{
   strict:true,noEmit:true,module:'NodeNext',moduleResolution:'NodeNext',target:'ES2022',types:['react'],
  }}));
  const check=(other:string,value:string)=>{
   writeFileSync(second,other);
   writeFileSync(usage,`import type {CSSProperties} from 'react';`+
    `const style:CSSProperties={'--tone':${value}}; void style;`);
   return spawnSync(join(root,'node_modules/.bin/tsc'),['-p',config,'--pretty','false'],{encoding:'utf8'});
  };
  for(const other of [declaration,previous]) {
   const valid=check(other,"'pink'");
   assert.equal(valid.status,0,valid.stdout+valid.stderr);
   const invalid=check(other,'false');
   assert.notEqual(invalid.status,0);
   assert.deepEqual(invalid.stdout.match(/error TS\d+/g),['error TS2322']);
  }
 } finally {rmSync(dir,{recursive:true,force:true});}
});
