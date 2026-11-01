// Joins the scan with kinds.json into catalog.json. A name in kinds.json the scan cannot find is an error.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { scan } from './scan.mjs';
const here = new URL('.', import.meta.url).pathname;
const inv = await scan();
const { kinds } = JSON.parse(await readFile(`${here}kinds.json`, 'utf8'));
const e = inv.unity.enums, unityNames = new Set([...e.WidgetDisplayGuiComponent, ...e.SynthModuleType, ...Object.values(e).flat()]);
const sets = { unity: unityNames, web: new Set([...inv.web.components, ...inv.web.composed]), kit: new Set(inv.baseball.kit), core: new Set(inv.baseball.core), skinForms: new Set(inv.unity.baseForms.components), containerForms: new Set(inv.unity.baseForms.containers) };
const missing = [];
for (const [k, row] of Object.entries(kinds)) for (const [src, set] of Object.entries(sets)) for (const n of row[src] ?? []) if (!set.has(n)) missing.push(`${k}.${src}: ${n}`);
const used = src => new Set(Object.values(kinds).flatMap(r => r[src] ?? []));
const unmapped = { web: [...sets.web].filter(n => !used('web').has(n) && n !== 'index'), kit: [...sets.kit].filter(n => !used('kit').has(n)), widgetKinds: e.WidgetDisplayGuiComponent.filter(n => n !== 'None' && !used('unity').has(n)), skinComponents: [...sets.skinForms].filter(n => !used('skinForms').has(n)), core: inv.baseball.core.filter(n => !used('core').has(n)).length };
const rev = (() => { try { return execFileSync('git', ['-C', new URL('../../slowbro-sports', import.meta.url).pathname, 'rev-parse', '--short', 'origin/dev']).toString().trim(); } catch { return null; } })();
const out = { generatedFrom: { baseballOriginDev: rev }, missing, kinds, styleAxes: { composableInBoth: inv.web.composableFields.filter(f => inv.unity.styleFields.includes(f)), csharpOnly: inv.unity.styleFields.filter(f => !inv.web.composableFields.includes(f)), tsOnly: inv.web.composableFields.filter(f => !inv.unity.styleFields.includes(f)) }, skins: inv.unity.skins, interactionStatus: e.WidgetInteractionStatus, unmapped, inventory: inv };
await writeFile(`${here}catalog.json`, JSON.stringify(out, null, 1));
const rows = Object.entries(kinds).map(([k, r]) => [k, (r.unity ?? []).length ? 'yes' : r.skinForms?.length || r.containerForms?.length ? 'skin only' : '-', (r.web ?? []).length || r.webDirs ? 'yes' : '-', (r.kit ?? []).length ? 'yes' : '-', (r.core ?? []).length ? 'yes' : '-', r.webFirst ? 'yes' : '-']);
console.log('kind|unity|synth-web|kit|core|web-first'); rows.forEach(r => console.log(r.join('|')));
console.log('\nunmapped', JSON.stringify(unmapped)); console.log('axes', JSON.stringify(out.styleAxes));
if (missing.length) { console.error('\nNames not found in the sources:\n ' + missing.join('\n ')); process.exit(1); }
