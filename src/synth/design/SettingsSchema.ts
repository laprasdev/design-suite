import type { SkinValues } from './Composable.ts';

export interface SettingDefinition {
  key: string;
  defaultVariant: string;
  variantKeys: string[];
  variants: Record<string, Record<string, unknown>>;
}

export interface ScopedSettingDefinition extends SettingDefinition {
  scopes: Record<string, string>;
}

export interface ContinuousSettingDefinition {
  key: string;
  value: unknown;
  options?: unknown[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function resolveSettingDefinition(
  skin: SkinValues, settingKey: string
): SettingDefinition | null {
  const defaultVal = skin.get(`settings.${settingKey}.default`);
  if (typeof defaultVal !== 'string') return null;

  const variantKeys: string[] = [];
  const variants: Record<string, Record<string, unknown>> = {};

  const prefix = `settings.${settingKey}.variants.`;
  for (const [k, v] of skin) {
    if (!k.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    const dot = rest.indexOf('.');
    const variantName = dot === -1 ? rest : rest.slice(0, dot);
    if (!variantKeys.includes(variantName)) variantKeys.push(variantName);
    if (!variants[variantName]) variants[variantName] = {};
    const propPath = dot === -1 ? '' : rest.slice(dot + 1);
    if (propPath) variants[variantName][propPath] = v;
    else variants[variantName] = typeof v === 'object' ? (v as Record<string, unknown>) : {};
  }

  return { key: settingKey, defaultVariant: defaultVal, variantKeys, variants };
}

export function resolveSettingScopes(
  skin: SkinValues, settingKey: string
): Record<string, string> {
  const scopes: Record<string, string> = {};
  const prefix = `settings.${settingKey}.scopes.`;
  for (const [k, v] of skin) {
    if (k.startsWith(prefix) && typeof v === 'string') {
      scopes[k.slice(prefix.length)] = v;
    }
  }
  return scopes;
}

export function resolveAllSettings(
  skin: SkinValues
): Map<string, SettingDefinition> {
  const result = new Map<string, SettingDefinition>();
  const seen = new Set<string>();

  for (const k of skin.keys()) {
    if (!k.startsWith('settings.')) continue;
    const rest = k.slice('settings.'.length);
    const dot = rest.indexOf('.');
    const settingKey = dot === -1 ? rest : rest.slice(0, dot);
    if (seen.has(settingKey)) continue;
    seen.add(settingKey);
    const def = resolveSettingDefinition(skin, settingKey);
    if (def) result.set(settingKey, def);
  }

  return result;
}

export function resolveContinuousSetting(
  skin: SkinValues, settingKey: string, subKey: string
): ContinuousSettingDefinition | null {
  const val = skin.get(`settings.${settingKey}.${subKey}`);
  if (val === undefined) return null;

  const optionsKey = `settings.${settingKey}.${subKey}Options`;
  const options = skin.get(optionsKey);

  return {
    key: `${settingKey}.${subKey}`,
    value: val,
    options: Array.isArray(options) ? options : undefined,
  };
}
