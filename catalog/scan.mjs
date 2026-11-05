// Reads the component kinds and tokens each source declares. Static only: never launches Unity.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const SUITE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ISM = path.resolve(SUITE, '../InfiniteStateMachine/packages');
const SM = `${ISM}/com.bloom.state-machine`;
const SYNTH = `${ISM}/synth-web/src`;
const BB = process.env.BASEBALL_ROOT || path.resolve(SUITE, '../slowbro-sports');
const SUITE_SYNTH = `${SUITE}/src/synth`;
const SKINS = `${SUITE}/unity/Runtime/Resources/SharedSchema/Design/Synth`;
const read = f => readFile(f, 'utf8');
const list = async (d, re) => (await readdir(d)).filter(f => re.test(f)).sort();

function enums(src) {
  const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  for (const m of code.matchAll(/enum\s+(\w+)\s*\{/g)) {
    let text = '', brace = 1, outer = 0;
    for (let i = m.index + m[0].length; brace > 0 && i < code.length; i++) {
      const c = code[i];
      if (c === '{') brace++; else if (c === '}') { if (--brace === 0) break; }
      if ('[('.includes(c)) outer++; else if ('])'.includes(c)) outer--; else if (outer === 0 && brace === 1) text += c;
    }
    out[m[1]] = text.split(',').map(x => x.trim().split(/\s*=/)[0].trim()).filter(x => /^[A-Z]\w*$/.test(x));
  }
  return out;
}
const reExports = src => [...src.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)].flatMap(m => m[1].split(',').map(s => s.trim()).filter(s => s && !s.startsWith('type ')).map(s => s.split(/\s+as\s+/).pop()));
const namedExports = src => [...src.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g)].map(m => m[1]);

export async function scan() {
  const widget = await read(`${SM}/Runtime/Interface/MenuDesign/SynthElements/Widgets/ElementScripts/WidgetDisplayGuiComponent.cs`);
  const style = await read(`${SM}/Runtime/Interface/MenuDesign/StyleData/HciComposableStyle.cs`);
  const skins = {};
  for (const f of await list(`${SKINS}/Skins`, /\.skin\.json$/)) {
    const d = JSON.parse(await read(`${SKINS}/Skins/${f}`));
    skins[f.replace('.skin.json', '')] = { inherit: d.meta?.inherit ?? null, priority: d.meta?.priority ?? null, forms: Object.keys(d.forms ?? {}), palette: Object.keys(d.forms?.base?.palette ?? {}), components: Object.keys(d.forms?.components ?? {}) };
  }
  const base = JSON.parse(await read(`${SKINS}/SynthSkin.json`));
  const tokens = JSON.parse(await read(`${SKINS}/SynthDesignTokens.json`));
  const composable = await read(`${SUITE_SYNTH}/design/Composable.ts`);
  const hci = composable.match(/export interface HciDataComposable \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const either = async (...fs) => { for (const f of fs) { try { return await read(f); } catch { /* next */ } } return null; };
  const kit = [await read(`${SUITE}/src/react/index.ts`),
    await read(`${SUITE}/src/react/preview3d/index.ts`),
    await read(`${SUITE}/src/react/preview3d/react.ts`)].join('\n');
  const kitRoot = await read(`${SUITE}/src/index.ts`);
  const gui = await either(`${BB}/packages/showdown-gui/src/react/index.ts`, `${BB}/packages/showdown-gui/src/react/index.js`) ?? '';
  const STYLES = (await readdir(`${BB}/src`)).includes('styles') ? `${BB}/src/styles` : `${BB}/src/baseball/styles`;
  const css = await list(STYLES, /\.css$/);
  const families = {};
  for (const f of css) for (const m of (await read(`${STYLES}/${f}`)).matchAll(/^\.([a-z][a-z0-9]*(?:-[a-z0-9]+)?)/gm)) (families[m[1]] ??= new Set()).add(f);
  return {
    unity: { enums: enums(widget), styleFields: [...style.matchAll(/^\s*public\s+[\w.<>,?\[\] ]+?\s+(\w+);/gm)].map(m => m[1]), skins, baseForms: { keys: Object.keys(base.forms), containers: Object.keys(base.forms.containers ?? {}), components: Object.keys(base.forms.components ?? {}) }, tokenKeys: Object.keys(tokens) },
    web: { components: [...await list(`${SUITE_SYNTH}/components/synth`, /\.tsx$/), ...await list(`${SYNTH}/components/synth`, /\.tsx$/)].map(f => f.replace('.tsx', '')), composed: namedExports(await read(`${SUITE_SYNTH}/design/ComposableComponents.tsx`)), composableFields: [...hci.matchAll(/^\s*(\w+)\??:/gm)].map(m => m[1]) },
    baseball: { root: BB, core: [...new Set((await list(`${BB}/src/core/views`, /^[A-Z].*\.(tsx|jsx)$/).catch(() => [])).map(f => f.replace(/\.\w+$/, '')))], kit: reExports(kit), kitRoot: reExports(kitRoot), showdownGui: reExports(gui), cssFamilies: Object.keys(families).sort() },
  };
}
if (process.argv[1] === new URL(import.meta.url).pathname) console.log(JSON.stringify(await scan(), null, 1));
