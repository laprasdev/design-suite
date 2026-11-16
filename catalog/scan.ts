// Reads the component kinds and tokens each source declares. Static only: never launches Unity.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNonEmptyString, isRecord } from '../src/valueChecks.ts';

export interface SkinSummary {
  readonly inherit: string | null;
  readonly priority: number | null;
  readonly forms: string[];
  readonly palette: string[];
  readonly components: string[];
}

/** The enums the catalog reads by name; the scan refuses a widget source that declares any of them no longer. */
export const CATALOG_ENUMS = ['WidgetDisplayGuiComponent', 'SynthModuleType', 'WidgetInteractionStatus'] as const;
export type UnityEnums = Readonly<Record<string, string[]> & Record<typeof CATALOG_ENUMS[number], string[]>>;

export interface ScanInventory {
  readonly unity: {
    readonly enums: UnityEnums;
    readonly styleFields: string[];
    readonly skins: Record<string, SkinSummary>;
    readonly baseForms: { readonly keys: string[]; readonly containers: string[]; readonly components: string[] };
    readonly tokenKeys: string[];
  };
  readonly web: {
    readonly components: string[];
    readonly composed: string[];
    readonly composableFields: string[];
  };
  readonly baseball: {
    readonly root: string;
    readonly core: string[];
    readonly kit: string[];
    readonly kitRoot: string[];
    readonly showdownGui: string[];
    readonly cssFamilies: string[];
  };
}

const SUITE = fileURLToPath(new URL('..', import.meta.url));
const ISM = path.resolve(SUITE, '../infinite-state-machine/packages');
const SM = `${ISM}/com.bloom.state-machine`;
const SYNTH = `${ISM}/synth-web/src`;
const BB = isNonEmptyString(process.env.BASEBALL_ROOT)
  ? process.env.BASEBALL_ROOT
  : path.resolve(SUITE, '../slowbro-sports');
const SUITE_SYNTH = `${SUITE}/src/synth`;
const SKINS = `${SUITE}/unity/Runtime/Resources/SharedSchema/Design/Synth`;

const read = (file: string): Promise<string> => readFile(file, 'utf8');
const list = async (dir: string, pattern: RegExp): Promise<string[]> =>
  (await readdir(dir)).filter(entry => pattern.test(entry)).sort();
const keysOf = (value: unknown): string[] => (isRecord(value) ? Object.keys(value) : []);

function parseJsonRecord(text: string, label: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed;
}

const declaresCatalogEnums = (found: Record<string, string[]>): found is UnityEnums =>
  CATALOG_ENUMS.every(name => Object.hasOwn(found, name));

function enums(src: string, file: string): UnityEnums {
  const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Record<string, string[]> = {};
  for (const match of code.matchAll(/enum\s+(\w+)\s*\{/g)) {
    let text = '';
    let brace = 1;
    let outer = 0;
    for (let index = (match.index ?? 0) + match[0].length; brace > 0 && index < code.length; index++) {
      const ch = code[index];
      if (ch === '{') brace++;
      else if (ch === '}' && --brace === 0) break;
      if ('[('.includes(ch)) outer++;
      else if ('])'.includes(ch)) outer--;
      else if (outer === 0 && brace === 1) text += ch;
    }
    out[match[1]] = text
      .split(',')
      .map(item => item.trim().split(/\s*=/)[0].trim())
      .filter(item => /^[A-Z]\w*$/.test(item));
  }
  if (!declaresCatalogEnums(out)) {
    const missing = CATALOG_ENUMS.filter(name => !Object.hasOwn(out, name));
    throw new Error(`scan: ${file} declares no enum ${missing.join(', ')}, which the catalog reads.`);
  }
  return out;
}

const reExports = (src: string): string[] =>
  [...src.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)].flatMap(match =>
    match[1]
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0 && !item.startsWith('type '))
      .map(item => {
        const parts = item.split(/\s+as\s+/);
        return parts[parts.length - 1];
      }));

const namedExports = (src: string): string[] =>
  [...src.matchAll(/export\s+(?:function|const|class)\s+(\w+)/g)].map(match => match[1]);

async function readFirstExisting(paths: readonly string[]): Promise<string> {
  for (const candidate of paths) {
    try {
      return await read(candidate);
    } catch {
      // Try next candidate path.
    }
  }
  return '';
}

function summarizeSkin(doc: Record<string, unknown>): SkinSummary {
  const meta = isRecord(doc.meta) ? doc.meta : {};
  const forms = isRecord(doc.forms) ? doc.forms : {};
  const baseForm = isRecord(forms.base) ? forms.base : {};
  return {
    inherit: typeof meta.inherit === 'string' ? meta.inherit : null,
    priority: typeof meta.priority === 'number' ? meta.priority : null,
    forms: Object.keys(forms),
    palette: keysOf(baseForm.palette),
    components: keysOf(forms.components),
  };
}

export async function scan(): Promise<ScanInventory> {
  const widgetPath = `${SM}/Runtime/Interface/MenuDesign/SynthElements/Widgets/ElementScripts/`
    + 'WidgetDisplayGuiComponent.cs';
  const widget = await read(widgetPath);
  const style = await read(`${SM}/Runtime/Interface/MenuDesign/StyleData/HciComposableStyle.cs`);
  const skins: Record<string, SkinSummary> = {};
  for (const file of await list(`${SKINS}/Skins`, /\.skin\.json$/)) {
    const doc = parseJsonRecord(await read(`${SKINS}/Skins/${file}`), file);
    skins[file.replace('.skin.json', '')] = summarizeSkin(doc);
  }
  const base = parseJsonRecord(await read(`${SKINS}/SynthSkin.json`), 'SynthSkin.json');
  const baseFormsDoc = isRecord(base.forms) ? base.forms : {};
  const tokens = parseJsonRecord(await read(`${SKINS}/SynthDesignTokens.json`), 'SynthDesignTokens.json');
  const composable = await read(`${SUITE_SYNTH}/design/Composable.ts`);
  const hci = composable.match(/export interface HciDataComposable \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const kit = [
    await read(`${SUITE}/src/react/index.ts`),
    await read(`${SUITE}/src/react/preview3d/index.ts`),
    await read(`${SUITE}/src/react/preview3d/react.ts`),
  ].join('\n');
  const kitRoot = await read(`${SUITE}/src/index.ts`);
  const gui = await readFirstExisting([
    `${BB}/packages/showdown-gui/src/react/index.ts`,
    `${BB}/packages/showdown-gui/src/react/index.js`,
  ]);
  const stylesDir = (await readdir(`${BB}/src`)).includes('styles') ? `${BB}/src/styles` : `${BB}/src/baseball/styles`;
  const cssFiles = await list(stylesDir, /\.css$/);
  const families = new Set<string>();
  for (const file of cssFiles) {
    for (const match of (await read(`${stylesDir}/${file}`)).matchAll(/^\.([a-z][a-z0-9]*(?:-[a-z0-9]+)?)/gm)) {
      families.add(match[1]);
    }
  }
  const synthFiles = [
    ...await list(`${SUITE_SYNTH}/components/synth`, /\.tsx$/),
    ...await list(`${SYNTH}/components/synth`, /\.tsx$/),
  ];
  const coreFiles = await list(`${BB}/src/core/views`, /^[A-Z].*\.(tsx|jsx)$/).catch((): string[] => []);
  return {
    unity: {
      enums: enums(widget, widgetPath),
      styleFields: [...style.matchAll(/^\s*public\s+[\w.<>,?[\] ]+?\s+(\w+);/gm)].map(match => match[1]),
      skins,
      baseForms: {
        keys: Object.keys(baseFormsDoc),
        containers: keysOf(baseFormsDoc.containers),
        components: keysOf(baseFormsDoc.components),
      },
      tokenKeys: Object.keys(tokens),
    },
    web: {
      components: synthFiles.map(file => file.replace('.tsx', '')),
      composed: namedExports(await read(`${SUITE_SYNTH}/design/ComposableComponents.tsx`)),
      composableFields: [...hci.matchAll(/^\s*(\w+)\??:/gm)].map(match => match[1]),
    },
    baseball: {
      root: BB,
      core: [...new Set(coreFiles.map(file => file.replace(/\.\w+$/, '')))],
      kit: reExports(kit),
      kitRoot: reExports(kitRoot),
      showdownGui: reExports(gui),
      cssFamilies: [...families].sort(),
    },
  };
}

if (import.meta.main) {
  console.log(JSON.stringify(await scan(), null, 1));
}
