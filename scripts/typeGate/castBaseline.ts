// The cast baseline: type assertions (`as T` and `<T>`, never `as const`) and non-null `!` assertions each hide a type
// the compiler could not prove. scripts/cast-baseline.json holds how many of each a file has, and the numbers only fall
// (scripts/baseline/baselinedFiles.ts): the type gate refuses a file that holds more, and writes the lower numbers.
import { readFileSync, writeFileSync } from 'node:fs';
import ts from '../gateTools/node_modules/typescript/lib/typescript.js';
import { OTHER_FIELDS, holdsRecordOf, holdsShape, type FieldCheck, type ShapeOf } from '../fieldChecks.ts';
import {
  OBJECT, anyRose, baselineRefusal, baselineText, fileEntries, holdsNumbers, jsonBlock, lowest, ratchetedFiles,
  type BaselineRule,
} from '../baseline/baselinedFiles.ts';

export const CAST_BASELINE = 'scripts/cast-baseline.json';
export const CAST_KINDS = ['casts', 'nonNullAssertions'] as const;
export type CastKind = typeof CAST_KINDS[number];
export type CastNumbers = Readonly<Record<CastKind, number>>;
export type CastSite = { readonly kind: CastKind; readonly file: string; readonly line: number };

const CAST_LABEL: Readonly<Record<CastKind, string>> = { casts: 'casts', nonNullAssertions: 'non-null assertions' };
/** What a file the baseline does not name may hold. */
export const NO_CASTS: CastNumbers = Object.freeze({ casts: 0, nonNullAssertions: 0 });

/** A cast baseline's one record, as its fields and their checks; its type and its check derive from it. */
const CAST_BASELINE_SHAPE = Object.freeze({ files: holdsRecordOf(holdsNumbers(CAST_KINDS)) });
export type CastBaseline = ShapeOf<typeof CAST_BASELINE_SHAPE>;
const holdsCastBaseline: FieldCheck<CastBaseline> = holdsShape(CAST_BASELINE_SHAPE, OTHER_FIELDS.refused);

export const CAST_RULE: BaselineRule<CastNumbers, CastNumbers> = {
  withinLimits: measured => CAST_KINDS.every(kind => measured[kind] === 0),
  lowered: lowest(CAST_KINDS),
  rose: anyRose,
};

/** A cast baseline from its decoded JSON; `file` names where it was read, for the refusal. */
export function parseCastBaseline(value: unknown, file: string): CastBaseline {
  holdsCastBaseline(value, '', baselineRefusal(`type gate: ${file}`));
  return value;
}

export const readCastBaseline = (file: string): CastBaseline =>
  parseCastBaseline(JSON.parse(readFileSync(file, 'utf8')), file);

export const castBaselineText = (baseline: CastBaseline): string =>
  baselineText({ files: jsonBlock(fileEntries(baseline.files), OBJECT) });

const isConstAssertion = (node: ts.AsExpression | ts.TypeAssertion): boolean =>
  ts.isTypeReferenceNode(node.type) && ts.isIdentifier(node.type.typeName) && node.type.typeName.text === 'const';

/** The kind of assertion `node` is, or null when it asserts nothing. */
export function castKindOf(node: ts.Node): CastKind | null {
  if (ts.isNonNullExpression(node)) return 'nonNullAssertions';
  if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && !isConstAssertion(node)) return 'casts';
  return null;
}

/** The numbers of each file that holds a site. */
export function castNumbers(sites: readonly CastSite[]): Map<string, CastNumbers> {
  const counted = new Map<string, Record<CastKind, number>>();
  for (const site of sites) {
    const counts = counted.get(site.file) ?? { ...NO_CASTS };
    counts[site.kind]++;
    counted.set(site.file, counts);
  }
  return counted;
}

const baselined = (baseline: CastBaseline, file: string): CastNumbers =>
  Object.hasOwn(baseline.files, file) ? baseline.files[file] : NO_CASTS;

/** Each file that holds more of a kind than its baseline, with the lines where that kind sits in it. */
export function castRefusals(
  baseline: CastBaseline,
  measured: ReadonlyMap<string, CastNumbers>,
  sites: readonly CastSite[],
): string[] {
  return [...measured].flatMap(([file, numbers]) => {
    const base = baselined(baseline, file);
    return CAST_KINDS.filter(kind => numbers[kind] > base[kind]).map(kind => {
      const lines = sites.filter(site => site.file === file && site.kind === kind).map(site => site.line);
      const held = `${numbers[kind]} ${CAST_LABEL[kind]}, baselined ${base[kind]}`;
      return `${file}: ${held}, at lines ${lines.join(', ')}; narrow by a check.`;
    });
  });
}

/** Each file that holds fewer of a kind than its baseline, which the ratchet lowers. */
export const castNotices = (baseline: CastBaseline, measured: ReadonlyMap<string, CastNumbers>): string[] =>
  Object.entries(baseline.files).flatMap(([file, base]) => {
    const numbers = measured.get(file) ?? NO_CASTS;
    return CAST_KINDS.filter(kind => numbers[kind] < base[kind])
      .map(kind => `ratchet: ${file} holds ${numbers[kind]} ${CAST_LABEL[kind]}, baselined ${base[kind]}`);
  });

/** Writes the lower numbers to `file`, dropping each file that now holds none. */
export function writeRatchetedCasts(
  file: string,
  baseline: CastBaseline,
  measured: ReadonlyMap<string, CastNumbers>,
): void {
  writeFileSync(file, castBaselineText({ files: ratchetedFiles(baseline.files, measured, CAST_RULE) }));
}
