// Generates a CaptionWidthTable JSON file from font files passed on the command line:
//   node scripts/captionWidths/generate.ts --out <table.json> <weight>=<font-file> [...]
import { readFile, writeFile } from 'node:fs/promises';
import { argv } from 'node:process';
import opentype from 'opentype.js';
import type { CaptionWidthTable, FontCutMetrics } from '../../src/captionWidths.ts';

const OUT_FLAG = '--out';
const PAIR_SEPARATOR = '=';
const ASCII_FIRST = 0x20;
const ASCII_LAST = 0x7e;
const EXTRA_CHARS = '\u00a0\u00b0\u00b7\u00d7\u2013\u2014\u2026\u2212';
const MEASURED_CHARS: readonly string[] = [
  ...Array.from({ length: ASCII_LAST - ASCII_FIRST + 1 }, (_, idx) => String.fromCharCode(ASCII_FIRST + idx)),
  ...EXTRA_CHARS,
];

function tagAt(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3),
  );
}

function coverageIndex(view: DataView, offset: number, glyphId: number): number {
  const format = view.getUint16(offset), count = view.getUint16(offset + 2);
  if (format === 1) {
    for (let i = 0; i < count; i++) if (view.getUint16(offset + 4 + i * 2) === glyphId) return i;
    return -1;
  }
  for (let i = 0; i < count; i++) {
    const start = view.getUint16(offset + 4 + i * 6), end = view.getUint16(offset + 6 + i * 6);
    if (glyphId >= start && glyphId <= end) return view.getUint16(offset + 8 + i * 6) + (glyphId - start);
  }
  return -1;
}

function glyphClass(view: DataView, offset: number, glyphId: number): number {
  const format = view.getUint16(offset);
  if (format === 1) {
    const start = view.getUint16(offset + 2), count = view.getUint16(offset + 4);
    return glyphId >= start && glyphId < start + count ? view.getUint16(offset + 6 + (glyphId - start) * 2) : 0;
  }
  const count = view.getUint16(offset + 2);
  for (let i = 0; i < count; i++) {
    const start = view.getUint16(offset + 4 + i * 6), end = view.getUint16(offset + 6 + i * 6);
    if (glyphId >= start && glyphId <= end) return view.getUint16(offset + 8 + i * 6);
  }
  return 0;
}

function valueRecordBytes(valueFormat: number): number {
  let bytes = 0;
  for (let mask = 1; mask <= 0x80; mask <<= 1) if (valueFormat & mask) bytes += 2;
  return bytes;
}

function xAdvanceAt(view: DataView, offset: number, valueFormat: number): number {
  if (!(valueFormat & 4)) return 0;
  return view.getInt16(offset + (valueFormat & 1 ? 2 : 0) + (valueFormat & 2 ? 2 : 0));
}

/** Reads GPOS Extension Positioning (LookupType 9) wrapping PairPos (LookupType 2), which opentype.js 1.x skips. */
function extensionPairKerning(bytes: Buffer): (leftGlyph: number, rightGlyph: number) => number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12) return () => 0;
  const tableCount = view.getUint16(4);
  let gpos = 0;
  for (let i = 0; i < tableCount; i++) {
    const record = 12 + i * 16;
    if (tagAt(view, record) === 'GPOS') gpos = view.getUint32(record + 8);
  }
  if (!gpos) return () => 0;
  const featureList = gpos + view.getUint16(gpos + 6), lookupList = gpos + view.getUint16(gpos + 8);
  const featureCount = view.getUint16(featureList), lookupIndexes: number[] = [];
  for (let i = 0; i < featureCount; i++) {
    const record = featureList + 2 + i * 6;
    if (tagAt(view, record) !== 'kern') continue;
    const feature = featureList + view.getUint16(record + 4), count = view.getUint16(feature + 2);
    for (let j = 0; j < count; j++) lookupIndexes.push(view.getUint16(feature + 4 + j * 2));
  }
  const subtables: number[] = [];
  for (const index of lookupIndexes) {
    const lookup = lookupList + view.getUint16(lookupList + 2 + index * 2);
    if (view.getUint16(lookup) !== 9) continue;
    const count = view.getUint16(lookup + 4);
    for (let s = 0; s < count; s++) {
      const ext = lookup + view.getUint16(lookup + 6 + s * 2);
      if (view.getUint16(ext + 2) === 2) subtables.push(ext + view.getUint32(ext + 4));
    }
  }
  return (leftGlyph, rightGlyph) => {
    let sum = 0;
    for (const sub of subtables) {
      const covered = coverageIndex(view, sub + view.getUint16(sub + 2), leftGlyph);
      if (covered < 0) continue;
      const format = view.getUint16(sub), vf1 = view.getUint16(sub + 4), vf2 = view.getUint16(sub + 6);
      const size1 = valueRecordBytes(vf1), size2 = valueRecordBytes(vf2);
      if (format === 1) {
        const pairSet = sub + view.getUint16(sub + 10 + covered * 2), pairCount = view.getUint16(pairSet);
        const step = 2 + size1 + size2;
        for (let i = 0; i < pairCount; i++) {
          const rec = pairSet + 2 + i * step;
          if (view.getUint16(rec) === rightGlyph) { sum += xAdvanceAt(view, rec + 2, vf1); break; }
        }
      } else if (format === 2) {
        const c1 = glyphClass(view, sub + view.getUint16(sub + 8), leftGlyph);
        const c2 = glyphClass(view, sub + view.getUint16(sub + 10), rightGlyph);
        const c2Count = view.getUint16(sub + 14);
        sum += xAdvanceAt(view, sub + 16 + (c1 * c2Count + c2) * (size1 + size2), vf1);
      }
    }
    return sum;
  };
}

export async function generateCutMetrics(fontFile: string): Promise<FontCutMetrics> {
  const bytes = await readFile(fontFile);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const font = opentype.parse(arrayBuffer);
  const extKern = extensionPairKerning(bytes);
  const glyphs = MEASURED_CHARS.map(ch => ({ ch, glyph: font.charToGlyph(ch) }));
  const advances: Record<string, number> = {};
  for (const { ch, glyph } of glyphs) advances[ch] = glyph.advanceWidth ?? 0;
  const kerning: Record<string, number> = {};
  for (const left of glyphs) {
    for (const right of glyphs) {
      const value = font.getKerningValue(left.glyph, right.glyph) + extKern(left.glyph.index, right.glyph.index);
      if (value !== 0) kerning[left.ch + right.ch] = value;
    }
  }
  return { unitsPerEm: font.unitsPerEm, advances, kerning };
}

export async function generateCaptionWidthTable(
  sources: Readonly<Record<string, string>>,
): Promise<CaptionWidthTable> {
  const entries = await Promise.all(
    Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))
      .map(async ([weight, file]): Promise<readonly [string, FontCutMetrics]> =>
        [weight, await generateCutMetrics(file)]),
  );
  return { cuts: Object.fromEntries(entries) };
}

function parseArgs(args: readonly string[]): { out: string; sources: Record<string, string> } {
  let out = '';
  const sources: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === OUT_FLAG) { out = args[++i] ?? ''; continue; }
    const sep = args[i].indexOf(PAIR_SEPARATOR);
    if (sep <= 0 || sep === args[i].length - 1) {
      throw new Error(`Expected <weight>=<font-file>, given "${args[i]}".`);
    }
    sources[args[i].slice(0, sep)] = args[i].slice(sep + 1);
  }
  if (!out || Object.keys(sources).length === 0) {
    throw new Error('Usage: generate.ts --out <table.json> <weight>=<font-file> [...]');
  }
  return { out, sources };
}

if (argv[1] && new URL(`file://${argv[1]}`).href === import.meta.url) {
  const { out, sources } = parseArgs(argv.slice(2));
  const table = await generateCaptionWidthTable(sources);
  await writeFile(out, `${JSON.stringify(table, null, 2)}\n`);
}
