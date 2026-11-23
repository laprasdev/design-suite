import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ChoiceForm, ControlKind } from '../src/fields.ts';
import { ModuleGridDimensions as G } from '../src/moduleGridLayout.ts';
import {
  COLOR_HEIGHT, CONTROL_KINDS, CUTOUT_HEIGHT, OPTION_BUTTON_HEIGHT, VECTOR_HEIGHT, controlBoxOf,
} from '../src/react/grid/controlBoxes.ts';
import { filledControlFit } from '../src/react/grid/filledControlFit.ts';
import { ONE_LINE_HEIGHT } from '../src/react/grid/lineTrack.ts';

describe('suite control kind boxes and stacked vs beside fit', () => {
  it('defines one canonical box and wordless flag for every ControlKind', () => {
    assert.deepEqual(
      Object.keys(CONTROL_KINDS).sort(),
      Object.values(ControlKind).sort(),
    );
    assert.equal(CONTROL_KINDS[ControlKind.TEXT].width, CONTROL_KINDS[ControlKind.NUMBER].width);
    assert.equal(CONTROL_KINDS[ControlKind.CURVE].width, G.curveWidth);
    assert.equal(CONTROL_KINDS[ControlKind.OPENS].width, G.openButtonWidth);
    assert.equal(CONTROL_KINDS[ControlKind.OPENS].height, G.openButtonHeight);
    assert.equal(CONTROL_KINDS[ControlKind.COLOR].height, COLOR_HEIGHT);
    assert.equal(CONTROL_KINDS[ControlKind.VECTOR].height, VECTOR_HEIGHT);
    assert.equal(CONTROL_KINDS[ControlKind.KNOB].wordless, false);
    assert.equal(CONTROL_KINDS[ControlKind.OPENS].wordless, false);
    assert.equal(CONTROL_KINDS[ControlKind.NUMBER].wordless, true);
    assert.equal(CONTROL_KINDS[ControlKind.CHOICE].wordless, true);
  });

  it('resolves multi-option flags, select choices, and range rows from CONTROL_KINDS', () => {
    assert.deepEqual(
      controlBoxOf({ kind: ControlKind.CHOICE, knobSize: 40, columns: 2, choiceForm: ChoiceForm.SELECT }),
      { width: G.openButtonWidth, height: CUTOUT_HEIGHT },
    );
    assert.deepEqual(
      controlBoxOf({ kind: ControlKind.RANGE, knobSize: 40, columns: 2 }),
      { width: 0, height: ONE_LINE_HEIGHT },
    );
    assert.deepEqual(
      controlBoxOf({ kind: ControlKind.FLAGS, knobSize: 40, columns: 4, optionCount: G.optionColumns * 2 }),
      { width: G.openButtonWidth, height: OPTION_BUTTON_HEIGHT * 2 + G.optionGap },
    );
  });

  it('keeps multi-column knobs stacked when the widest piece fits the column even if name + reading exceeds it', () => {
    // 3 columns inside 402 px -> columnRoom = (402 - 12 - 16) / 3 = 124.67 px.
    // Stacked piece = 72 px (fits 124.67 px), beside sum = 132 px (exceeds 124.67 px).
    const fit = filledControlFit(402, 460, 3, 4, { stacked: 72, beside: 132 });
    assert.equal(fit.beside, false);
    assert.equal(fit.size, G.controlMax);

    // Narrowed to 1 column, it switches to beside and sizes the knob from the beside sum.
    const narrow = filledControlFit(180, 120, 1, 1, { stacked: 72, beside: 110 });
    assert.equal(narrow.beside, true);
    assert.equal(narrow.size, G.controlMin);
  });
});
