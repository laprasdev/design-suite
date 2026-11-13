import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {modelStageLighting} from '../src/react/preview3d/lightingModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {describing, held} from './preview3dActorFixture.ts';

// Every record of the description states exactly its fields: for each one, by its path, every field it omits and a
// field it does not have are refused by name. The table is the records' own list, so a record left out of it shows.
type Path = readonly (string | number)[];
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const at = (value: unknown, path: Path) => path.reduce<unknown>((node, step) =>
  (node as Record<string | number, unknown>)[step], value);
// `shape` names the field a record of several shapes is told apart by (its own refusal is the shape's), or null.
function exact(check: (value: unknown) => unknown, whole: unknown, path: Path, where: string, fields: string[],
  shape: string | null) {
  const record = at(whole, path) as Record<string, unknown>;
  assert.deepEqual(Object.keys(record).sort(), [...fields].sort(), where);
  const refused = (change: (copy: Record<string, unknown>) => void, pattern: RegExp) => {
    const copy = structuredClone(whole);
    change(at(copy, path) as Record<string, unknown>);
    assert.throws(() => check(copy), (error: unknown) =>
      error instanceof ModelStageRefusal && pattern.test(error.message), `${where}: ${pattern}`);
  };
  refused(copy => {copy.stray = 1;}, new RegExp(`^${escaped(where)} does not state stray; it states`));
  for (const field of fields.filter(name => name !== shape)) {
    refused(copy => {delete copy[field];}, new RegExp(`^${escaped(where)} omits ${field}\\.$`));
  }
}

const LOOK = {backdrop: [0, 0, 0], key: {color: [1, 1, 1], strength: 1, direction: [0, 1, 0]},
  ambient: {sky: [1, 1, 1], ground: [0, 0, 0], strength: 1}, shadow: [0, 0, 0], night: 0,
  aids: {floor: [0, 0, 0], share: 1}, toneCurve: null, glow: {threshold: 1, strength: 1, radius: 0.5},
  fog: {near: {distance: 2, color: [0, 0, 0]}, far: {distance: 9, color: [0, 0, 0]},
    height: {base: 0, top: 1, strength: 0.5}}};
const LIGHTING = {time: 'dusk', times: [{id: 'dusk', label: 'Dusk', look: LOOK}]};
const TIME = 'Time dusk: look';
// The fields the description's records of several shapes are told apart by.
const SHAPES = ['kind', 'rule'];

describe('every record of the description', () => {
  it('refuses, by its path, each field a time, its look or the lighting omits, and one it does not have', () => {
    const rows: Array<[Path, string, string[]]> = [
      [[], 'The lighting', ['time', 'times']], [['times', 0], 'Time 0', ['id', 'label', 'look']],
      [['times', 0, 'look'], TIME, Object.keys(LOOK)],
      [['times', 0, 'look', 'key'], `${TIME}.key`, ['color', 'strength', 'direction']],
      [['times', 0, 'look', 'ambient'], `${TIME}.ambient`, ['sky', 'ground', 'strength']],
      [['times', 0, 'look', 'aids'], `${TIME}.aids`, ['floor', 'share']],
      [['times', 0, 'look', 'fog'], `${TIME}.fog`, ['near', 'far', 'height']],
      [['times', 0, 'look', 'fog', 'near'], `${TIME}.fog.near`, ['distance', 'color']],
      [['times', 0, 'look', 'fog', 'far'], `${TIME}.fog.far`, ['distance', 'color']],
      [['times', 0, 'look', 'fog', 'height'], `${TIME}.fog.height`, ['base', 'top', 'strength']],
      [['times', 0, 'look', 'glow'], `${TIME}.glow`, ['threshold', 'strength', 'radius']],
    ];
    for (const [path, where, fields] of rows) exact(modelStageLighting, LIGHTING, path, where, fields, null);
  });

  it('refuses, by its path, each field the description, its actors, an asset, a clip, framing or size omits', () => {
    const whole = describing({framing: {kind: 'pose', position: [0, 0, 4], target: [0, 0, 0]},
      size: {rule: 'normalized', height: 2}});
    const actor = whole.actors.actors[0];
    const posed = {...whole, actors: {...whole.actors, actors: [{...actor, animation: held('run', 0.5)}]}};
    const rows: Array<[Path, string, string[]]> = [
      [[], 'The stage description', Object.keys(whole)], [['actors'], 'The actors', ['focus', 'actors']],
      [['actors', 'actors', 0], 'Actor 0', ['id', 'asset', 'placement', 'animation']],
      [['actors', 'actors', 0, 'animation'], `Actor ${actor.id}.animation`, ['kind', 'name', 'timeSeconds']],
      [['framing'], 'The framing', ['kind', 'position', 'target']], [['size'], 'The stage size', ['rule', 'height']],
    ];
    for (const [path, where, fields] of rows) {
      exact(modelStageDescription, posed, path, where, fields, fields.find(field => SHAPES.includes(field)) ?? null);
    }
    // An asset states its id and path, and its revision, digest and profile only when it has them.
    const asset = {...whole, actors: {...whole.actors, actors: [{...actor, asset: {id: 'otter', path: '/otter.glb'}}]}};
    exact(modelStageDescription, asset, ['actors', 'actors', 0, 'asset'], `Actor ${actor.id}.asset`, ['id', 'path'],
      null);
  });
});
