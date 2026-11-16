// The cast ratchet: type assertions (`as T` and `<T>`, never `as const`) and non-null `!` assertions each hide a type
// the compiler could not prove. AGENTS.md records how many the repository holds; the type gate refuses any other
// count, so a new one is refused and a removed one lowers the record, which therefore only falls.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from '../gateTools/node_modules/typescript/lib/typescript.js';

export const CAST_RECORD_FILE = 'AGENTS.md';
export const CAST_KINDS = ['cast', 'non-null assertion'] as const;
export type CastKind = typeof CAST_KINDS[number];
export type CastCounts = Record<CastKind, number>;
export type CastSite = { readonly kind: CastKind; readonly where: string };
export const NO_CASTS: Readonly<CastCounts> = Object.freeze({ cast: 0, 'non-null assertion': 0 });

/** The sentence AGENTS.md holds, which states the counts the gate compares with. */
export const castRecord = (counts: CastCounts): string =>
  `Cast ratchet: ${counts.cast} casts and ${counts['non-null assertion']} non-null assertions.`;
const CAST_RECORD = /Cast ratchet: (\d+) casts and (\d+) non-null assertions\./;

const isConstAssertion = (node: ts.AsExpression | ts.TypeAssertion): boolean =>
  ts.isTypeReferenceNode(node.type) && ts.isIdentifier(node.type.typeName) && node.type.typeName.text === 'const';

/** The kind of assertion `node` is, or null when it asserts nothing. */
export function castKindOf(node: ts.Node): CastKind | null {
  if (ts.isNonNullExpression(node)) return 'non-null assertion';
  if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && !isConstAssertion(node)) return 'cast';
  return null;
}

export function readCastRecord(root: string): CastCounts {
  const match = CAST_RECORD.exec(readFileSync(path.join(root, CAST_RECORD_FILE), 'utf8'));
  if (!match) throw new Error(`type gate: ${CAST_RECORD_FILE} states no "${castRecord(NO_CASTS)}" record.`);
  return { cast: Number(match[1]), 'non-null assertion': Number(match[2]) };
}

/** Every site, by file and line, when a kind grew; the record to write when one fell. */
export function castRefusals(recorded: CastCounts, sites: readonly CastSite[]): string[] {
  const found: CastCounts = { ...NO_CASTS };
  for (const site of sites) found[site.kind]++;
  const grown = CAST_KINDS.filter(kind => found[kind] > recorded[kind]);
  const refusals = sites.filter(site => grown.includes(site.kind)).map(site => `${site.where}: ${site.kind}.`);
  for (const kind of grown) {
    const above = `above the ${recorded[kind]} ${CAST_RECORD_FILE} records`;
    refusals.push(`${found[kind]} ${kind}s, ${above}; narrow by a check.`);
  }
  if (grown.length === 0 && CAST_KINDS.some(kind => found[kind] < recorded[kind])) {
    refusals.push(`the casts fell; record "${castRecord(found)}" in ${CAST_RECORD_FILE}.`);
  }
  return refusals;
}
