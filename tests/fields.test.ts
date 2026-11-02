import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FieldState, YES_NO_NEXT, YesNo, yesNoOf, type FieldStateValue, type YesNoValue } from '../src/fields.ts';

describe('what a yes/no draws', () => {
  const states = Object.values(FieldState);
  it('draws a plain bool as on or off, whatever its state says', () => {
    for (const state of states) {
      assert.equal(yesNoOf(state, true, false), YesNo.ON);
      assert.equal(yesNoOf(state, false, false), YesNo.OFF);
    }
  });
  it('draws an overridable one as not set or inherit until it is set, and then as its value', () => {
    const drawn: Record<FieldStateValue, [YesNoValue, YesNoValue]> = {
      [FieldState.SET]: [YesNo.ON, YesNo.OFF],
      [FieldState.UNSET]: [YesNo.UNSET, YesNo.UNSET],
      [FieldState.INHERITED]: [YesNo.INHERIT, YesNo.INHERIT],
    };
    for (const state of states) {
      assert.deepEqual([yesNoOf(state, true, true), yesNoOf(state, false, true)], drawn[state]);
    }
  });
  it('steps an overridable press through all four and round again', () => {
    const seen = [YesNo.UNSET];
    for (let step = 0; step < Object.values(YesNo).length; step++) seen.push(YES_NO_NEXT[seen.at(-1)!]);
    assert.deepEqual(seen, [YesNo.UNSET, YesNo.ON, YesNo.OFF, YesNo.INHERIT, YesNo.UNSET]);
  });
});
