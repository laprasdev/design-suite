import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OTHER_FIELDS, holdsListOf, holdsNonEmptyString, holdsNumber, holdsOptional, holdsRecord, holdsRecordOf,
  holdsShapeWithFields, holdsString, holdsStringList, refusalBy, type FieldCheck,
} from '../scripts/fieldChecks.ts';

const refuse = refusalBy(reason => {
  throw new Error(reason);
}, 'the record');
const WHERE = 'x';
/** `value` read through `check` at `WHERE`. */
function read(check: FieldCheck<unknown>, value: unknown): void {
  check(value, WHERE, refuse);
}

/** Each leaf check, a value it holds, a value of another type, and the reason it refuses that one. */
const LEAVES: readonly { check: FieldCheck<unknown>; holds: unknown; wrong: unknown; why: string }[] = [
  { check: holdsString, holds: '', wrong: 5, why: 'must be a string' },
  { check: holdsNonEmptyString, holds: 'a', wrong: '', why: 'must be a non-empty string' },
  { check: holdsNumber, holds: 0, wrong: '259', why: 'must be a number' },
  { check: holdsRecord, holds: {}, wrong: [], why: 'must be a record' },
  { check: holdsStringList, holds: [], wrong: 'a', why: 'must be a list' },
];

describe('a field check', () => {
  it('holds a value of its type and refuses one of another, naming the place', () => {
    for (const { check, holds, wrong, why } of LEAVES) {
      read(check, holds);
      assert.throws(() => read(check, wrong), new Error(`${WHERE} ${why}`));
    }
  });

  it('refuses a list entry or a record member of the wrong type at its own place', () => {
    assert.throws(() => read(holdsListOf(holdsNumber), [1, 'b']), new Error(`${WHERE}[1] must be a number`));
    assert.throws(() => read(holdsRecordOf(holdsNumber), { a: null }), new Error(`${WHERE}["a"] must be a number`));
  });

  it('takes an optional field left out, and refuses it of the wrong type', () => {
    read(holdsOptional(holdsString), undefined);
    assert.throws(() => read(holdsOptional(holdsString), 5), new Error(`${WHERE} must be a string`));
  });

  it('checks a shape\'s fields and the same fields in one walk, refusing a field the two both name', () => {
    const check = holdsShapeWithFields({ name: holdsString }, { fields: ['a', 'b'], check: holdsNumber },
      OTHER_FIELDS.refused);
    read(check, { name: 'n', a: 1, b: 2 });
    assert.throws(() => read(check, { name: 3, a: 1, b: 2 }), new Error(`${WHERE}.name must be a string`));
    assert.throws(() => read(check, { name: 'n', a: 1, b: 'c' }), new Error(`${WHERE}.b must be a number`));
    assert.throws(() => read(check, { name: 'n', a: 1, b: 2, c: 3 }),
      new Error(`${WHERE} holds c; it takes name, a, b`));
    assert.throws(() => holdsShapeWithFields({ a: holdsString }, { fields: ['a'], check: holdsNumber },
      OTHER_FIELDS.refused), /a named by both the shape and the same fields/);
  });
});
