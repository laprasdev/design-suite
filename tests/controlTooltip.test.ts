// A control's tooltip has one rule, the one every knob and toggle reads: its own, else the host's description of its
// label, else the one it generates. A host files its descriptions under camelCase keys (the web synth's
// TooltipDescriptions.ts: coyoteTime, hSpeed, gravity), so a label finds its description by its words in camelCase.
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {bundled} from './bundled.ts';

interface TooltipModule {
  descriptionKey(label: string): string;
  controlTooltip(own: string | undefined, label: string | undefined, descriptions: Readonly<Record<string, string>>,
    generated: string): string;
}
const {module: tooltips, dispose} = await bundled<TooltipModule>(['src/synth/components/synth/TooltipContext.tsx']);
after(dispose);

/** Keys as the web synth's descriptions file them. */
const HOST = {coyoteTime: 'Grace frames after leaving ground', hSpeed: 'Horizontal velocity range',
  gravity: 'Fall pull', selectStart: 'Modifier states', lfo2Rate: 'Second LFO rate'};

describe('control tooltips', () => {
  it('keys a label by its words in camelCase, whatever its case and separators', () => {
    assert.equal(tooltips.descriptionKey('COYOTE TIME'), 'coyoteTime');
    assert.equal(tooltips.descriptionKey('Coyote time'), 'coyoteTime');
    assert.equal(tooltips.descriptionKey('H Speed'), 'hSpeed');
    assert.equal(tooltips.descriptionKey('Select/Start'), 'selectStart');
    assert.equal(tooltips.descriptionKey('  LFO 2 rate '), 'lfo2Rate');
    assert.equal(tooltips.descriptionKey('GRAVITY'), 'gravity');
  });

  it("finds the host's description of an upper-case label", () => {
    assert.equal(tooltips.controlTooltip(undefined, 'COYOTE TIME', HOST, 'generated'), HOST.coyoteTime);
    assert.equal(tooltips.controlTooltip(undefined, 'H SPEED', HOST, 'generated'), HOST.hSpeed);
  });

  it('keeps its own tooltip first, and generates one when the host describes nothing by that label', () => {
    assert.equal(tooltips.controlTooltip('Own', 'GRAVITY', HOST, 'generated'), 'Own');
    assert.equal(tooltips.controlTooltip(undefined, 'Cutoff', HOST, 'Cutoff: 0.5'), 'Cutoff: 0.5');
    assert.equal(tooltips.controlTooltip(undefined, undefined, HOST, 'Knob: 0.5'), 'Knob: 0.5');
  });

  it('reads only the descriptions the host states, never a name every object inherits', () => {
    assert.equal(tooltips.controlTooltip(undefined, 'Constructor', HOST, 'generated'), 'generated');
    assert.equal(tooltips.controlTooltip(undefined, 'to string', HOST, 'generated'), 'generated');
  });
});
