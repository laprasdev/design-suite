import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {prepareWhole} from '../src/react/preview3d/commit.ts';
import {ModelStageRefusal} from '../src/react/preview3d/model.ts';
import {at, harness} from './preview3dActorSetFixture.ts';

const PASSES_FAILED = 'Time t: look.glow: the bloom passes could not be loaded: offline';
describe('what a description\'s parts need loaded', () => {
  it('waits for what the parts need loaded, as for a model, and refuses when that load fails', async () => {
    const {set, loading, replace} = harness();
    const first = replace(at('a'));
    loading('a').settle();
    await first;
    const settle: Array<(fail: boolean) => void> = [];
    const need = () => new Promise<void>((resolve, reject) => {
      settle.push(fail => fail ? reject(new ModelStageRefusal(PASSES_FAILED)) : resolve());
    });
    let shown = 0;
    // Each attempt's loads, and whether it let go of them: once shown, refused or superseded.
    const released: number[] = [];
    const needing = () => {
      const index = settle.length;
      return {pending: [need()], release: () => {released.push(index);}};
    };
    const waiting = set.replace({focus: 'a', actors: [at('a', 2)]}, needing(), staged => {
      shown++;
      prepareWhole([staged.prepare])();
    });
    assert.deepEqual([set.pending, shown], [true, 0]);
    settle[0](false);
    await waiting;
    assert.deepEqual([set.pending, shown, set.actors[0].snapshot().pose.position], [false, 1, [2, 0, 0]]);
    assert.deepEqual(released, [0], 'shown: its loads let go');
    const failing = set.replace({focus: 'a', actors: [at('a', 3)]}, needing(), () => {shown++;});
    settle[1](true);
    // A part's failed load refuses in its own words, never as the actors' failure.
    await assert.rejects(failing, (error: unknown) => error instanceof ModelStageRefusal &&
      error.message === PASSES_FAILED);
    assert.deepEqual([set.pending, shown, set.actors[0].snapshot().pose.position], [false, 1, [2, 0, 0]]);
    assert.deepEqual(released, [0, 1], 'refused: its loads let go');
    const superseded = set.replace({focus: 'a', actors: [at('a', 4)]}, needing(), () => {shown++;});
    const latest = set.replace({focus: 'a', actors: [at('a', 5)]}, needing(),
      staged => prepareWhole([staged.prepare])());
    assert.deepEqual(released, [0, 1, 2], 'superseded the moment a later attempt is taken');
    settle[2](false);
    settle[3](false);
    await Promise.all([superseded, latest]);
    assert.deepEqual(released, [0, 1, 2, 3]);
    // A part whose load fails by a defect, not a refusal, is not dressed as the actors' refusal: it goes on as it is.
    const defect = new Error('a part\'s defect');
    const broken = set.replace({focus: 'a', actors: [at('a', 6)]}, {pending: [Promise.reject(defect)],
      release: () => undefined}, () => {shown++;});
    await assert.rejects(broken, (error: unknown) => error === defect);
  });
});
