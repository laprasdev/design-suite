import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelGlow, loadModelGlowPasses, modelGlowKernel} from '../src/react/preview3d/glow.ts';

// The glow's blur, step E3: three's bloom weighs its taps as a Gaussian cut off at one standard deviation, a near-flat
// kernel that draws square halos at the game's emission strengths; the stage gives each level a Gaussian that falls
// to nothing at its last tap.
describe('the glow\'s blur', () => {
  it('weighs each level\'s taps as a Gaussian three deviations wide, falling to nothing at its last tap', () => {
    for (const radius of [3, 5, 7, 9, 11]) {
      const weights = modelGlowKernel(radius);
      assert.equal(weights.length, radius);
      assert.equal(weights[0], 1);
      assert.ok(weights.every((weight, tap) => tap === 0 || weight < weights[tap - 1]), 'falling');
      assert.ok(weights[radius - 1] < 0.14, `${radius}: its last tap ${weights[radius - 1]}`);
      // three's own: exp(-tap² / 2 radius²), whose last tap weighs about 0.6 of its first.
      assert.ok(Math.exp(-0.5 * ((radius - 1) / radius) ** 2) > 0.6);
    }
  });

  it('is what every blur level of the glow\'s bloom pass is given', async () => {
    const passes = await loadModelGlowPasses(), made: InstanceType<typeof passes.Bloom>[] = [];
    class Watched extends passes.Bloom {
      constructor(...args: ConstructorParameters<typeof passes.Bloom>) {
        super(...args);
        made.push(this);
      }
    }
    const glow = createModelGlow({...passes, Bloom: Watched}, new THREE.Vector2(64, 64));
    const levels = made[0].separableBlurMaterials;
    assert.equal(levels.length, 5);
    for (const level of levels) {
      assert.deepEqual(level.uniforms.gaussianCoefficients.value, modelGlowKernel(Number(level.defines.KERNEL_RADIUS)));
    }
    glow.dispose();
  });
});
