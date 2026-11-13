import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelFog, MODEL_FOG_CHANGE} from '../src/react/preview3d/fog.ts';
import {createModelEnvironment} from '../src/react/preview3d/environment.ts';
import {createModelStageAids} from '../src/react/preview3d/scene.ts';
import {modelMaterialChanges} from '../src/react/preview3d/shading.ts';
import {modelDrawnMaterials} from '../src/react/preview3d/renderers.ts';

const materialsUnder = (root: THREE.Object3D) => [...modelDrawnMaterials(root).keys()];

describe('what the stage\'s fog reaches', () => {
  it('reaches every piece of the scenery: its boxes, its plane and the plane\'s grid', () => {
    const fog = createModelFog(new THREE.Scene());
    const environment = createModelEnvironment({reflectZ: false, boxes: [{id: 'crate', position: [0, 0, 0],
      size: [1, 1, 1], color: [0.5, 0.5, 0.5]}], plane: {position: [0, 0, 0], size: [4, 4], color: [0.2, 0.2, 0.2],
      grid: {spacing: 1, color: [0.4, 0.4, 0.4]}}}, fog.change);
    const names = ['crate', 'plane', 'plane-grid'];
    for (const name of names) {
      const piece = environment.group.getObjectByName(name);
      assert.ok(piece, name);
      for (const material of materialsUnder(piece)) {
        assert.deepEqual(modelMaterialChanges(material).map(({key}) => key), [MODEL_FOG_CHANGE], name);
      }
    }
    environment.dispose();
  });

  it('reaches none of the stage\'s own floor and grid', () => {
    const theme = {colors: {stage: '#000000', text: '#ffffff', surface: '#111111', surfaceHi: '#222222',
      accent: '#ff0000', accentDeep: '#880000', teal: '#00ffff'}};
    const aids = createModelStageAids(theme, {clock: 'local', floor: true, grid: true, kinds: new Map()},
      {floor: () => undefined, attach: () => () => undefined});
    assert.equal(aids.length, 2);
    for (const material of aids.flatMap(materialsUnder)) assert.equal(Reflect.get(material, 'fog'), false);
  });
});
