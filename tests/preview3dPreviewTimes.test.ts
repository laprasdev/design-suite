import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {createModelPreviewChoices, modelPreviewDescription, modelPreviewSelectionOf, modelPreviewTimes}
  from '../src/react/preview3d/previewDescription.ts';
import {describing} from './preview3dActorFixture.ts';

// The person's choice of time is a choice among the times that exist, offered from a lighting the stage accepts.
describe('the view\'s times', () => {
  const host = modelStageDescription(describing());
  it('drops a chosen time the host removes or renames, keeping the other choices, and composes no missing time', () => {
    const look = {backdrop: [0, 0, 0], key: {color: [1, 1, 1], strength: 1, direction: [0, 1, 0]},
      ambient: {sky: [1, 1, 1], ground: [0, 0, 0], strength: 1}, shadow: [0, 0, 0], night: 1,
      aids: {floor: [0, 0, 0], share: 1}, fog: null, toneCurve: null, glow: null};
    const offering = (...ids: string[]) => modelStageDescription({...host, lighting: {time: 'light',
      times: ids.map(id => ({id, label: id, look}))}});
    const choices = createModelPreviewChoices(offering('dusk'));
    const chosen = {...modelPreviewSelectionOf(offering('dusk')), display: 'rig' as const, lighting: 'dusk'};
    choices.take(offering('dusk'), chosen);
    assert.deepEqual(choices.declared(offering('dusk', 'dawn')), chosen);
    for (const host of [offering(), offering('evening')]) {
      const selection = choices.declared(host);
      assert.deepEqual(selection, {...chosen, lighting: 'light'});
      // What the view then sends is a description the stage takes, not one naming a time that is gone.
      modelStageDescription(modelPreviewDescription(host, selection));
    }
  });

  it('offers times only from a lighting the stage\'s check accepts, or from the description the stage holds', () => {
    assert.deepEqual(modelPreviewTimes(host.lighting, undefined).map(({value}) => value), ['light', 'dark']);
    // The old two-value form, or times that are not a list: never read unchecked, never a TypeError in a render.
    for (const value of ['light', {time: 'light', times: 3}]) {
      assert.deepEqual(modelPreviewTimes(value, undefined), []);
      assert.deepEqual(modelPreviewTimes(value, host), modelPreviewTimes(host.lighting, undefined));
    }
  });

});
