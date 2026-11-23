import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeSyntheticFont } from '../scripts/captionWidths/syntheticFont.ts';
import { captionWidth, readingWidth, textRunWidth, type CaptionWidthTable } from '../src/captionWidths.ts';
import { Typography } from '../src/tokens.ts';

const GENERATOR = fileURLToPath(new URL('../scripts/captionWidths/generate.ts', import.meta.url));

describe('caption width generator and reader', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'suite-caption-widths-'));
  const fontFile = path.join(dir, 'Fixture-SemiBold.otf');
  const outFile = path.join(dir, 'table.json');
  after(() => { unlinkSync(fontFile); unlinkSync(outFile); rmdirSync(dir); });

  it('generates a table from passed font files and reads single-line widths with kerning and tracking', () => {
    writeSyntheticFont(fontFile);
    execFileSync(process.execPath, [
      GENERATOR, '--out', outFile,
      `${Typography.label.fontWeight}=${fontFile}`,
      `${Typography.moduleValue.fontWeight}=${fontFile}`,
    ]);
    const parsed: CaptionWidthTable = JSON.parse(readFileSync(outFile, 'utf8'));
    assert.equal(captionWidth('ab', parsed), 14);
    assert.equal(readingWidth('AB', parsed), 13.4);
    assert.equal(captionWidth('', parsed), 0);
    const kerned: CaptionWidthTable = {
      cuts: {
        '600': {
          unitsPerEm: 1000,
          advances: { A: 600, V: 600 },
          kerning: { AV: -100 },
        },
      },
    };
    assert.equal(textRunWidth('AV', { fontSize: 10, fontWeight: 600, letterSpacing: '0.05em' }, kerned), 12);
  });

  it('refuses missing weights, missing characters and non-em letterSpacing by name', () => {
    const table: CaptionWidthTable = { cuts: { '600': { unitsPerEm: 1000, advances: { A: 500 }, kerning: {} } } };
    assert.throws(() => textRunWidth('A', { fontSize: 10, fontWeight: 500, letterSpacing: '0.05em' }, table),
      /no cut for weight 500/);
    assert.throws(() => captionWidth('Z', table), /no advance for "Z"/);
    assert.throws(() => textRunWidth('A', { fontSize: 10, fontWeight: 600, letterSpacing: '1px' }, table),
      /Expected letterSpacing in "em"/);
  });
});
