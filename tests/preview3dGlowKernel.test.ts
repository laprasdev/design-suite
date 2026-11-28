import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelGlow, loadModelGlowPasses} from '../src/react/preview3d/glow.ts';

// The glow's blur, step E3: a bloom whose taps weigh as a Gaussian cut off at one standard deviation draws square halos
// at the game's emission strengths. three r182's bloom weighs each level's taps as a Gaussian three deviations wide
// (UnrealBloomPass.js `_getSeparableBlurMaterial`), so its last tap weighs nearly nothing; the glow draws with it.
const LEVELS = 5, LAST_TAP_MOST = 0.14;
describe('the glow\'s blur', () => {
  it('weighs every level\'s taps as a Gaussian falling to nothing at its last tap', async () => {
    const passes = await loadModelGlowPasses(), made: InstanceType<typeof passes.Bloom>[] = [];
    class Watched extends passes.Bloom {
      constructor(...args: ConstructorParameters<typeof passes.Bloom>) {
        super(...args);
        made.push(this);
      }
    }
    const glow = createModelGlow({...passes, Bloom: Watched}, new THREE.Vector2(64, 64));
    const levels = made[0].separableBlurMaterials;
    assert.equal(levels.length, LEVELS);
    for (const level of levels) {
      const taps: number[] = level.uniforms.gaussianCoefficients.value, radius = Number(level.defines.KERNEL_RADIUS);
      assert.equal(taps.length, radius);
      const share = taps.map(tap => tap / taps[0]);
      assert.ok(share.every((weight, tap) => tap === 0 || weight < share[tap - 1]), `${radius}: falling`);
      assert.ok(share[radius - 1] < LAST_TAP_MOST, `${radius}: its last tap weighs ${share[radius - 1]} of its first`);
    }
    glow.dispose();
  });
});
