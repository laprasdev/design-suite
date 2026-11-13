import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelBackdrop} from '../src/react/preview3d/backdrop.ts';
import {modelStageBuiltInTimes} from '../src/react/preview3d/builtInTimes.ts';
import {MODEL_TONE_CURVE_TEXT} from '../src/react/preview3d/toneCurve.ts';
import {modelColorOfHex} from '../src/react/preview3d/colorModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {MODEL_STAGE_LAYERS} from '../src/react/preview3d/layers.ts';
import {createTheme} from '../src/theme.ts';
import {createSkinTheme} from '../src/skinTheme.ts';
import {SKIN_NAMES} from '../src/skins.ts';
import {shownBytes, statedBytes} from './preview3dToneCurveOracle.ts';

const linear = (srgb: readonly number[]) => new THREE.Color().setRGB(srgb[0], srgb[1], srgb[2], THREE.SRGBColorSpace)
  .toArray();
// Every theme a consumer passes today (the Q9 audit): the default theme, Workbench's, and every skin's.
const THEMES = [createTheme(), createTheme({name: 'workbench'}), ...SKIN_NAMES.map(name => createSkinTheme(name))];

describe('the backdrop', () => {
  it('is drawn in the scene, first and behind everything, through three\'s tone curve and display encoding', () => {
    const backdrop = createModelBackdrop(), {mesh} = backdrop, material = mesh.material as THREE.ShaderMaterial;
    const source = material.fragmentShader;
    assert.ok(source.indexOf('#include <tonemapping_fragment>') < source.indexOf('#include <colorspace_fragment>'));
    assert.ok(source.indexOf('gl_FragColor = vec4( modelStageBackdrop, 1.0 );') <
      source.indexOf('#include <tonemapping_fragment>'), 'its colour is curved, then encoded');
    assert.deepEqual([material.toneMapped, material.fog, material.depthTest, material.depthWrite, mesh.frustumCulled,
      mesh.renderOrder, mesh.layers.mask], [true, false, false, false, false, Number.NEGATIVE_INFINITY,
      MODEL_STAGE_LAYERS.scene]);
    assert.match(material.vertexShader, /gl_Position = vec4\( position.xy, 1.0, 1.0 \);/, 'at the far plane');
    backdrop.set([0.2, 0.4, 0.6]);
    assert.deepEqual(material.uniforms.modelStageBackdrop.value.toArray(), linear([0.2, 0.4, 0.6]));
  });

  it('is stated by each built-in time as the colour its curve shows as the one behind, for every theme in reach',
    () => {
    for (const theme of THEMES) {
      const [light, dark] = modelStageBuiltInTimes(theme.colors);
      assert.equal(light.look.toneCurve, 'aces-filmic');
      assert.deepEqual(shownBytes(linear(light.look.backdrop), light.look.toneCurve),
        statedBytes(modelColorOfHex(theme.colors.stage, 'stage')), theme.name);
      // Dark shows its deep colour behind, and keeps it as its ambient's ground and its shadow.
      const deep = modelColorOfHex('#05080f', 'Dark');
      assert.deepEqual(shownBytes(linear(dark.look.backdrop), dark.look.toneCurve), statedBytes(deep), theme.name);
      assert.deepEqual([dark.look.shadow, dark.look.ambient.ground], [deep, deep]);
      assert.deepEqual([light.look.shadow, light.look.ambient.ground], [modelColorOfHex(theme.colors.surface, 's'),
        modelColorOfHex(theme.colors.surface, 's')]);
    }
  });

  it('refuses, by name, a theme whose stage colour the curve cannot show', () => {
    const colors = {...createTheme().colors, stage: '#ffffff'};
    assert.throws(() => modelStageBuiltInTimes(colors), (error: unknown) => error instanceof ModelStageRefusal &&
      error.message === MODEL_TONE_CURVE_TEXT.unreachable('Time light: look.backdrop', 'aces-filmic', [1, 1, 1]));
  });
});
