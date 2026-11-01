// The one source of skins and design tokens. Unity reads these same files through
// Resources; every web consumer imports them here, with no server route or fetch.
import baseSkin from '../unity/Runtime/Resources/SharedSchema/Design/Synth/SynthSkin.json' with {type: 'json'};
import designTokens from '../unity/Runtime/Resources/SharedSchema/Design/Synth/SynthDesignTokens.json' with {type: 'json'};
import analog from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/analog.skin.json' with {type: 'json'};
import bloom from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/bloom.skin.json' with {type: 'json'};
import cutout from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/cutout.skin.json' with {type: 'json'};
import flat from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/flat.skin.json' with {type: 'json'};
import midnight from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/midnight.skin.json' with {type: 'json'};
import neon from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/neon.skin.json' with {type: 'json'};
import promethium from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/promethium.skin.json' with {type: 'json'};
import serum from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/serum.skin.json' with {type: 'json'};
import test from '../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/test.skin.json' with {type: 'json'};

export type SkinJson = Record<string, unknown>;
interface SkinMeta { inherit?: string; label?: string; priority?: number }

export const SKIN_FILES: Readonly<Record<string, SkinJson>> = {analog, bloom, cutout, flat, midnight, neon, promethium, serum, test};
const BASE_SKIN_REFERENCE = '../SynthSkin.json';
const SKIN_SUFFIX = '.skin.json';
const NO_PARENT = 'null'; // How the base skin says it has no parent.

const metaOf = (skin: SkinJson) => (skin.meta ?? {}) as SkinMeta;
const isObject = (value: unknown): value is SkinJson => typeof value === 'object' && value !== null && !Array.isArray(value);

export function deepMerge(parent: SkinJson, child: SkinJson): SkinJson {
  const merged = {...parent};
  for (const [key, value] of Object.entries(child)) {
    const existing = merged[key];
    merged[key] = isObject(value) && isObject(existing) ? deepMerge(existing, value) : value;
  }
  return merged;
}

function parentOf(skin: SkinJson): [string, SkinJson] | null {
  const reference = metaOf(skin).inherit;
  if (reference === BASE_SKIN_REFERENCE) return [reference, baseSkin];
  if (!reference || reference === NO_PARENT) return null;
  const parent = SKIN_FILES[reference.replace(SKIN_SUFFIX, '')];
  if (!parent) throw new Error(`Unknown skin reference: ${reference}`);
  return [reference, parent];
}

function resolveChain(skin: SkinJson, visited: Set<string>): SkinJson {
  const parent = parentOf(skin);
  if (!parent) return skin;
  const [reference, source] = parent;
  if (visited.has(reference)) throw new Error(`Circular skin inheritance: ${reference}`);
  visited.add(reference);
  return deepMerge(resolveChain(source, visited), skin);
}

/** One skin with everything it inherits. */
export function resolveSkin(name: string): SkinJson {
  const skin = SKIN_FILES[name];
  if (!skin) throw new Error(`Unknown skin: ${name}`);
  return resolveChain(skin, new Set());
}

/** Tokens plus the resolved skin: every design value a surface can read. */
export const resolveDesignSystem = (name: string): SkinJson => deepMerge(designTokens, resolveSkin(name));

const byPriority = (a: string, b: string) => (metaOf(SKIN_FILES[b]).priority ?? 0) - (metaOf(SKIN_FILES[a]).priority ?? 0);

/** Every skin, highest priority first, in the order Unity sorts them. */
export const SKIN_NAMES: readonly string[] = Object.keys(SKIN_FILES).sort(byPriority);
export const DEFAULT_SKIN = SKIN_NAMES[0];
/** The skins a person can pick, with their display names. */
export const SELECTABLE_SKINS = SKIN_NAMES.filter(name => metaOf(SKIN_FILES[name]).label)
  .map(name => ({name, label: metaOf(SKIN_FILES[name]).label as string}));

export function flattenSkin(skin: SkinJson, prefix = ''): Map<string, unknown> {
  const flattened = new Map<string, unknown>();
  for (const [key, value] of Object.entries(skin)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(value)) flattenSkin(value, path).forEach((nested, nestedPath) => flattened.set(nestedPath, nested));
    else flattened.set(path, value);
  }
  return flattened;
}

export {baseSkin, designTokens};
