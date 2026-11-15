// Joins the scan with kinds.json into catalog.json. A name in kinds.json the scan cannot find is an error.
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRecord } from '../src/valueChecks.ts';
import { scan } from './scan.ts';

type SourceKey = 'unity' | 'web' | 'kit' | 'core' | 'skinForms' | 'containerForms';

interface KindRow {
  readonly unity?: readonly string[];
  readonly web?: readonly string[];
  readonly webDirs?: readonly string[];
  readonly kit?: readonly string[];
  readonly core?: readonly string[];
  readonly skinForms?: readonly string[];
  readonly containerForms?: readonly string[];
  readonly webFirst?: string;
}

const SOURCE_KEYS: readonly SourceKey[] = ['unity', 'web', 'kit', 'core', 'skinForms', 'containerForms'];

function readStringList(value: unknown, where: string): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw new Error(`kinds.json: ${where} must be a list of strings.`);
  }
  return value;
}

function readKinds(raw: unknown): { rows: Record<string, KindRow>; rawKinds: Record<string, unknown> } {
  if (!isRecord(raw) || !isRecord(raw.kinds)) throw new Error('kinds.json must state a kinds object.');
  const rows: Record<string, KindRow> = {};
  for (const [kind, entry] of Object.entries(raw.kinds)) {
    if (!isRecord(entry)) throw new Error(`kinds.json: kinds.${kind} must be an object.`);
    if (entry.webFirst !== undefined && typeof entry.webFirst !== 'string') {
      throw new Error(`kinds.json: ${kind}.webFirst must be a string.`);
    }
    rows[kind] = {
      unity: readStringList(entry.unity, `${kind}.unity`),
      web: readStringList(entry.web, `${kind}.web`),
      webDirs: readStringList(entry.webDirs, `${kind}.webDirs`),
      kit: readStringList(entry.kit, `${kind}.kit`),
      core: readStringList(entry.core, `${kind}.core`),
      skinForms: readStringList(entry.skinForms, `${kind}.skinForms`),
      containerForms: readStringList(entry.containerForms, `${kind}.containerForms`),
      webFirst: entry.webFirst,
    };
  }
  return { rows, rawKinds: raw.kinds };
}

function baseballRevision(here: string): string | null {
  try {
    const repo = path.resolve(here, '../../slowbro-sports');
    return execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'origin/dev']).toString().trim();
  } catch {
    return null;
  }
}

const here = fileURLToPath(new URL('.', import.meta.url));
const inv = await scan();
const { rows: kinds, rawKinds } = readKinds(JSON.parse(await readFile(path.join(here, 'kinds.json'), 'utf8')));
const unityEnums = inv.unity.enums;
const widgetDisplay = unityEnums.WidgetDisplayGuiComponent ?? [];
const moduleTypes = unityEnums.SynthModuleType ?? [];
const sets: Record<SourceKey, Set<string>> = {
  unity: new Set([...widgetDisplay, ...moduleTypes, ...Object.values(unityEnums).flat()]),
  web: new Set([...inv.web.components, ...inv.web.composed]),
  kit: new Set(inv.baseball.kit),
  core: new Set(inv.baseball.core),
  skinForms: new Set(inv.unity.baseForms.components),
  containerForms: new Set(inv.unity.baseForms.containers),
};

const missing: string[] = [];
for (const [kind, row] of Object.entries(kinds)) {
  for (const src of SOURCE_KEYS) {
    for (const name of row[src] ?? []) {
      if (!sets[src].has(name)) missing.push(`${kind}.${src}: ${name}`);
    }
  }
}

const used = (src: SourceKey): Set<string> => new Set(Object.values(kinds).flatMap(row => row[src] ?? []));
const usedWeb = used('web');
const usedKit = used('kit');
const usedUnity = used('unity');
const usedSkinForms = used('skinForms');
const usedCore = used('core');

const unmapped = {
  web: [...sets.web].filter(name => !usedWeb.has(name) && name !== 'index'),
  kit: [...sets.kit].filter(name => !usedKit.has(name)),
  widgetKinds: widgetDisplay.filter(name => name !== 'None' && !usedUnity.has(name)),
  skinComponents: [...sets.skinForms].filter(name => !usedSkinForms.has(name)),
  core: inv.baseball.core.filter(name => !usedCore.has(name)).length,
};

const out = {
  generatedFrom: { baseballOriginDev: baseballRevision(here) },
  missing,
  kinds: rawKinds,
  styleAxes: {
    composableInBoth: inv.web.composableFields.filter(field => inv.unity.styleFields.includes(field)),
    csharpOnly: inv.unity.styleFields.filter(field => !inv.web.composableFields.includes(field)),
    tsOnly: inv.web.composableFields.filter(field => !inv.unity.styleFields.includes(field)),
  },
  skins: inv.unity.skins,
  interactionStatus: unityEnums.WidgetInteractionStatus ?? [],
  unmapped,
  inventory: inv,
};

await writeFile(path.join(here, 'catalog.json'), JSON.stringify(out, null, 1));
const summaryRows = Object.entries(kinds).map(([kind, row]) => [
  kind,
  (row.unity ?? []).length ? 'yes' : row.skinForms?.length || row.containerForms?.length ? 'skin only' : '-',
  (row.web ?? []).length || row.webDirs?.length ? 'yes' : '-',
  (row.kit ?? []).length ? 'yes' : '-',
  (row.core ?? []).length ? 'yes' : '-',
  row.webFirst ? 'yes' : '-',
]);
console.log('kind|unity|synth-web|kit|core|web-first');
summaryRows.forEach(row => console.log(row.join('|')));
console.log('\nunmapped', JSON.stringify(unmapped));
console.log('axes', JSON.stringify(out.styleAxes));
if (missing.length) {
  console.error('\nNames not found in the sources:\n ' + missing.join('\n '));
  process.exit(1);
}
