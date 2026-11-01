import type React from 'react';

export type SkinValues = Map<string, unknown>;

// ─── COMPONENT TYPES (mirror C# DesignTokens+Schema.cs) ───

export interface PaletteComponent {
  primary: string | null;
  secondary: string | null;
  tertiary: string | null;
  accent: string | null;
  background: string | null;
  backgroundGradient: string | null;
  text: string | null;
  border: string | null;
  glow: string | null;
  inactive: string | null;
  cutoutBackground: string | null;
  cutoutBorder: string | null;
}

export interface SizingComponent {
  scaleOffset: number;
  aspectRatio: number | null;
}

export interface SpacingComponent {
  padding: [number, number];
}

export interface ContentShapeComponent {
  cornerRadius: number;
  roundedCorners?: string[];
}

export interface TextComponent {
  size: number | null;
  kern: number;
  lead: number;
  weight: number;
  family: string | null;
}

export interface EdgeComponent {
  width: number;
  outset: number;
}

export interface ShadowComponent {
  opacity?: number;
  offset: [number, number];
  blur: number;
  spread: number;
  inset: boolean;
}

export interface GlyphComponent {
  resourcePath: string | null;
}

export interface OpacityComponent {
  value: number;
}

// ─── COMPOSABLE (bundle of optional components) ───

export interface HciDataComposable {
  palette: PaletteComponent | null;
  sizing: SizingComponent | null;
  spacing: SpacingComponent | null;
  contentShape: ContentShapeComponent | null;
  text: TextComponent | null;
  edge: EdgeComponent | null;
  border?: { width: number; borderEdges?: string[]; aboveContent?: boolean } | null;
  shadow: ShadowComponent | null;
  glyph: GlyphComponent | null;
  opacity: OpacityComponent | null;
}

// ─── RESOLUTION ───

function resolveComponent<T>(
  skin: SkinValues,
  prefix: string,
  fields: Record<keyof T, (v: unknown) => unknown>,
): T | null {
  let hasAny = false;
  const result = {} as Record<string, unknown>;
  for (const [field, convert] of Object.entries(fields)) {
    const v = skin.get(`${prefix}.${field}`);
    if (v !== undefined) {
      result[field] = (convert as (v: unknown) => unknown)(v);
      hasAny = true;
    } else {
      result[field] = null;
    }
  }
  return hasAny ? (result as T) : null;
}

function identity(v: unknown) { return v; }
function asNum(v: unknown) { return typeof v === 'number' ? v : null; }
function asStr(v: unknown) { return typeof v === 'string' ? v : null; }
function asBool(v: unknown) { return typeof v === 'boolean' ? v : false; }

function resolvePair(
  skin: SkinValues, key: string
): [number, number] | null {
  const direct = skin.get(key);
  if (Array.isArray(direct) && direct.length >= 2
    && typeof direct[0] === 'number' && typeof direct[1] === 'number')
    return [direct[0], direct[1]];
  const a = skin.get(`${key}.0`);
  const b = skin.get(`${key}.1`);
  if (typeof a === 'number' && typeof b === 'number') return [a, b];
  return null;
}

function resolvePalette(
  skin: SkinValues, prefix: string
): PaletteComponent | null {
  return resolveComponent<PaletteComponent>(skin, prefix, {
    primary: asStr,
    secondary: asStr,
    tertiary: asStr,
    accent: asStr,
    background: asStr,
    backgroundGradient: asStr,
    text: asStr,
    border: asStr,
    glow: asStr,
    inactive: asStr,
    cutoutBackground: asStr,
    cutoutBorder: asStr,
  });
}

function resolveSizing(
  skin: SkinValues, prefix: string
): SizingComponent | null {
  return resolveComponent<SizingComponent>(skin, prefix, {
    scaleOffset: asNum,
    aspectRatio: asNum,
  });
}

function resolveSpacing(
  skin: SkinValues, prefix: string
): SpacingComponent | null {
  const pair = resolvePair(skin, `${prefix}.padding`);
  if (!pair) {
    const single = skin.get(`${prefix}.padding`);
    if (typeof single === 'number') return { padding: [single, single] };
    return null;
  }
  return { padding: pair };
}

function resolveContentShape(
  skin: SkinValues, prefix: string
): ContentShapeComponent | null {
  return resolveComponent<ContentShapeComponent>(skin, prefix, {
    cornerRadius: asNum,
    roundedCorners: identity,
  });
}

function resolveText(
  skin: SkinValues, prefix: string
): TextComponent | null {
  return resolveComponent<TextComponent>(skin, prefix, {
    size: asNum,
    kern: asNum,
    lead: asNum,
    weight: asNum,
    family: asStr,
  });
}

function resolveEdge(
  skin: SkinValues, prefix: string
): EdgeComponent | null {
  return resolveComponent<EdgeComponent>(skin, prefix, {
    width: asNum,
    outset: asNum,
  });
}

function resolveShadow(
  skin: SkinValues, prefix: string
): ShadowComponent | null {
  const offset = resolvePair(skin, `${prefix}.offset`);
  const blur = skin.get(`${prefix}.blur`);
  const opacity = skin.get(`${prefix}.opacity`);
  if (!offset && blur === undefined && opacity === undefined) return null;
  return {
    opacity: typeof opacity === 'number' ? opacity : undefined,
    offset: offset ?? [0, 0],
    blur: typeof blur === 'number' ? blur : 0,
    spread: typeof skin.get(`${prefix}.spread`) === 'number'
      ? skin.get(`${prefix}.spread`) as number : 0,
    inset: asBool(skin.get(`${prefix}.inset`)),
  };
}

function resolveGlyph(
  skin: SkinValues, prefix: string
): GlyphComponent | null {
  return resolveComponent<GlyphComponent>(skin, prefix, {
    resourcePath: asStr,
  });
}

function resolveOpacity(
  skin: SkinValues, prefix: string
): OpacityComponent | null {
  return resolveComponent<OpacityComponent>(skin, prefix, {
    value: asNum,
  });
}

export function resolveComposable(
  skin: SkinValues, prefix: string
): HciDataComposable {
  return {
    palette: resolvePalette(skin, `${prefix}.palette`),
    sizing: resolveSizing(skin, `${prefix}.sizing`),
    spacing: resolveSpacing(skin, `${prefix}.spacing`),
    contentShape: resolveContentShape(skin, `${prefix}.contentShape`),
    text: resolveText(skin, `${prefix}.text`),
    edge: resolveEdge(skin, `${prefix}.edge`),
    border: resolveComponent<NonNullable<HciDataComposable['border']>>(skin, `${prefix}.border`, { width: asNum, borderEdges: identity, aboveContent: asBool }),
    shadow: resolveShadow(skin, `${prefix}.shadow`),
    glyph: resolveGlyph(skin, `${prefix}.glyph`),
    opacity: resolveOpacity(skin, `${prefix}.opacity`),
  };
}

// ─── MERGE (child overrides parent, null = inherit) ───

function mergeComponent<T>(
  parent: T | null, child: T | null
): T | null {
  if (!child) return parent;
  if (!parent) return child;
  const merged = { ...parent };
  for (const key of Object.keys(child) as (keyof T)[]) {
    const childVal = child[key];
    if (childVal !== null && childVal !== undefined)
      (merged as Record<string, unknown>)[key as string] = childVal;
  }
  return merged;
}

export function mergeComposable(
  parent: HciDataComposable, child: HciDataComposable
): HciDataComposable {
  return {
    palette: mergeComponent(parent.palette, child.palette),
    sizing: mergeComponent(parent.sizing, child.sizing),
    spacing: mergeComponent(parent.spacing, child.spacing),
    contentShape: mergeComponent(parent.contentShape, child.contentShape),
    text: mergeComponent(parent.text, child.text),
    edge: mergeComponent(parent.edge, child.edge),
    border: mergeComponent(parent.border ?? null, child.border ?? null),
    shadow: mergeComponent(parent.shadow, child.shadow),
    glyph: mergeComponent(parent.glyph, child.glyph),
    opacity: mergeComponent(parent.opacity, child.opacity),
  };
}

// ─── RESOLVE WITH INHERITANCE ───

export function resolveComposableWithInherit(
  skin: SkinValues, prefix: string
): HciDataComposable {
  const self = resolveComposable(skin, prefix);
  const inheritRef = skin.get(`${prefix}.inherit`) as string | undefined;
  if (!inheritRef) return self;
  const parent = resolveComposableWithInherit(skin, inheritRef);
  return mergeComposable(parent, self);
}

// ─── NAMED COMPOSABLE LOOKUPS ───

export function resolveBaseComposable(
  skin: SkinValues
): HciDataComposable {
  return resolveComposable(skin, 'base');
}

export function resolveTokenComposable(
  skin: SkinValues, key: string
): HciDataComposable {
  const base = resolveBaseComposable(skin);
  const child = resolveComposable(skin, `composables.${key}`);
  return mergeComposable(base, child);
}

export function resolveContainerComposable(
  skin: SkinValues, containerType: string
): HciDataComposable {
  return resolveComposableWithInherit(
    skin, `forms.containers.${containerType}`
  );
}

export function resolveComponentComposable(
  skin: SkinValues, componentType: string
): HciDataComposable {
  return resolveComposableWithInherit(
    skin, `forms.components.${componentType}`
  );
}

// ─── CSS CONVERSION ───

export function paddingCSS(padding?: number[]): string | undefined {
  return padding?.length ? (padding.length === 2 ? [padding[1], padding[0]] : padding).map(value => `${value}px`).join(' ') : undefined;
}

export function containerCSS(c: HciDataComposable): React.CSSProperties {
  const width = c.border?.width ?? c.edge?.width ?? 1, edges = c.border?.borderEdges;
  const color = (c.border ? c.palette?.border : c.palette?.cutoutBorder) ?? c.palette?.border ?? 'transparent';
  return {
    background: c.palette?.cutoutBackground ?? c.palette?.background ?? undefined,
    border: `${width}px solid ${color}`,
    ...(edges ? { borderTopWidth: edges.includes('up') ? width : 0, borderRightWidth: edges.includes('right') ? width : 0,
      borderBottomWidth: edges.includes('down') ? width : 0, borderLeftWidth: edges.includes('left') ? width : 0 } : {}),
    borderRadius: c.contentShape?.roundedCorners?.length === 0 ? 0 : c.contentShape?.cornerRadius,
    boxShadow: c.shadow?.opacity === 0 ? 'none' : undefined,
    padding: paddingCSS(c.spacing?.padding),
    opacity: c.opacity?.value,
  };
}

export function textCSS(c: HciDataComposable): React.CSSProperties {
  return {
    color: c.palette?.text ?? c.palette?.primary ?? undefined,
    fontSize: c.text?.size ?? undefined,
    fontWeight: c.text?.weight,
    fontFamily: c.text?.family ?? undefined,
    letterSpacing: c.text?.kern != null ? `${c.text.kern}em` : undefined,
    lineHeight: c.text?.lead,
    opacity: c.opacity?.value,
  };
}

export function accentTextCSS(c: HciDataComposable): React.CSSProperties {
  return {
    ...textCSS(c),
    color: c.palette?.primary ?? undefined,
  };
}

export function dividerCSS(c: HciDataComposable): React.CSSProperties {
  return {
    height: c.edge?.width ?? 1,
    background: c.palette?.primary ?? c.palette?.border ?? undefined,
    opacity: c.opacity?.value,
  };
}
