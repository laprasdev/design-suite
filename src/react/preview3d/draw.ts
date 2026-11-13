import * as THREE from 'three';
import type {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import type {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {MODEL_STAGE_TONE_CURVE, type ModelStageGlow, type ModelStageToneCurve} from './lookModel.ts';
import type {ModelStageCommit} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_STAGE_LAYERS} from './layers.ts';

const CURVES: Readonly<Record<ModelStageToneCurve, THREE.ToneMapping>> = Object.freeze({
  [MODEL_STAGE_TONE_CURVE.acesFilmic]: THREE.ACESFilmicToneMapping,
});
// The output pass: the target's colour (the scene and its bloom, linear) to the canvas through three's own tone curve
// and display encoding (the chunks three gives every material drawn to the canvas), and the target's depth into the
// canvas's depth, so that the aids drawn after it hide behind the scene as they do in the direct draw.
const OUTPUT = Object.freeze({vertexShader: 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n' +
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n}',
fragmentShader: 'uniform sampler2D modelSceneColor;\nuniform sampler2D modelSceneDepth;\nvarying vec2 vUv;\n' +
  'void main() {\n  gl_FragColor = texture2D( modelSceneColor, vUv );\n' +
  '  gl_FragDepth = texture2D( modelSceneDepth, vUv ).r;\n  #include <tonemapping_fragment>\n' +
  '  #include <colorspace_fragment>\n}'});
// The samples of the glow's target: the canvas's own antialiasing, kept for the one draw of the scene.
const SAMPLES = 4;
// What three must offer for glow: a colour buffer of half floats, for the linear source and the bloom's own targets.
const HALF_FLOAT = Object.freeze(['EXT_color_buffer_float', 'EXT_color_buffer_half_float']);
export const MODEL_DRAW_TEXT = Object.freeze({
  halfFloat: (where: string) => `${where}: glow needs half-float render targets; this browser's WebGL has none.`,
  unloaded: 'The glow was prepared before its passes were loaded.',
  passes: (where: string, why: string) => `${where}: the bloom passes could not be loaded: ${why}`,
});
// What three r180 keeps for a material it compiled (WebGLRenderer.getProgram) and on that program after its first use
// (WebGLProgram.js onFirstUse); its typings declare neither.
interface Compiled {
  readonly currentProgram: THREE.WebGLProgram & {readonly diagnostics?: {readonly runnable: boolean;
    readonly programLog: string; readonly vertexShader: {readonly log: string};
    readonly fragmentShader: {readonly log: string}}};
}
interface GlowPasses {readonly Bloom: typeof UnrealBloomPass; readonly Quad: typeof FullScreenQuad}
type Glow = {target: THREE.WebGLRenderTarget; depth: THREE.DepthTexture; bloom: UnrealBloomPass;
  output: FullScreenQuad; material: THREE.ShaderMaterial};
// The glow's passes are three's own, fetched the first time a look brings glow, so a page that never glows never
// downloads them.
async function loadGlowPasses(): Promise<GlowPasses> {
  const [bloom, pass] = await Promise.all([import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/Pass.js')]);
  return {Bloom: bloom.UnrealBloomPass, Quad: pass.FullScreenQuad};
}

/**
 * The frame's one draw. Without glow it is the scene, aids included, through the camera to the canvas under the
 * look's tone curve or none, exactly as three draws it. With glow the scene's look is drawn once, in linear light,
 * into a multisampled half-float target; three's bloom pass adds its bloom into that target, still linear (its last
 * blend made to add the bloom's colour as it is, so a glow's strength means what it meant before); one output pass
 * writes the canvas through the look's tone curve and the display encoding, and the target's depth; the stage's aids
 * are drawn last, untoned, behind the scene where it is in front of them. No material changes program between frames.
 */
export function createModelDraw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const size = new THREE.Vector2();
  let passes: GlowPasses | undefined, loading: Promise<void> | undefined;
  let glow: Glow | undefined, curve = THREE.NoToneMapping as THREE.ToneMapping;
  let triangles = 0;
  const release = () => {
    if (!glow) return;
    glow.depth.dispose();
    glow.target.dispose();
    glow.bloom.dispose();
    // three r180's UnrealBloomPass.dispose frees every material of the pass but its high-pass filter.
    glow.bloom.materialHighPassFilter.dispose();
    glow.output.dispose();
    glow.material.dispose();
    glow = undefined;
  };
  const create = ({Bloom, Quad}: GlowPasses): Glow => {
    renderer.getDrawingBufferSize(size);
    const depth = new THREE.DepthTexture(size.x, size.y);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType, samples: SAMPLES,
      depthTexture: depth});
    const bloom = new Bloom(size, 0, 0, 0);
    // The pass blends its composite by its alpha, which a half-float target does not hold to 1: added as it is.
    Object.assign(bloom.blendMaterial, {blending: THREE.CustomBlending, blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor});
    const material = new THREE.ShaderMaterial({...OUTPUT, depthFunc: THREE.AlwaysDepth,
      uniforms: {modelSceneColor: {value: target.texture}, modelSceneDepth: {value: depth}}});
    return {target, depth, bloom, material, output: new Quad(material)};
  };
  const pass = (mask: number, into: THREE.WebGLRenderTarget | null) => {
    camera.layers.mask = mask;
    renderer.setRenderTarget(into);
    renderer.render(scene, camera);
    triangles += renderer.info.render.triangles;
  };
  const glowing = (value: Glow) => {
    pass(MODEL_STAGE_LAYERS.scene, value.target);
    value.bloom.render(renderer, value.target, value.target, 0, false);
    renderer.setRenderTarget(null);
    renderer.toneMapping = curve;
    value.output.render(renderer);
    renderer.toneMapping = THREE.NoToneMapping;
    const clears = renderer.autoClear;
    renderer.autoClear = false;
    pass(MODEL_STAGE_LAYERS.aids, null);
    renderer.autoClear = clears;
  };
  const bloom = (value: ModelStageGlow, loaded: GlowPasses) => {
    glow ??= create(loaded);
    glow.bloom.threshold = value.threshold;
    glow.bloom.strength = value.strength;
    glow.bloom.radius = value.radius;
  };
  // The curve the canvas is drawn under: the direct draw's, or the output pass's under glow (set as it draws).
  const apply = (value: ModelStageToneCurve | null) => {
    curve = value === null ? THREE.NoToneMapping : CURVES[value];
    renderer.toneMapping = curve;
  };
  return {
    /** What drawing this glow needs loaded first: the glow's passes, fetched once, when a look first brings glow;
     * `where` names the glow in a refusal. */
    load(value: ModelStageGlow | null, where: string): readonly Promise<void>[] {
      if (value === null || passes) return [];
      loading ??= loadGlowPasses().then(loaded => {passes = loaded;}, (error: unknown) => {
        loading = undefined;
        throw new ModelStageRefusal(MODEL_DRAW_TEXT.passes(where, error instanceof Error ? error.message :
          String(error)), {cause: error});
      });
      return [loading];
    },
    /** A look's tone curve and glow, checked; `where` names the glow in a refusal. */
    prepare(toneCurve: ModelStageToneCurve | null, value: ModelStageGlow | null, where: string): ModelStageCommit {
      if (value === null) return () => {apply(toneCurve); release();};
      if (!HALF_FLOAT.some(name => renderer.extensions.has(name))) {
        throw new ModelStageRefusal(MODEL_DRAW_TEXT.halfFloat(where));
      }
      const loaded = passes;
      if (!loaded) throw new Error(MODEL_DRAW_TEXT.unloaded);
      return () => {apply(toneCurve); bloom(value, loaded);};
    },
    /** The canvas changed size: the glow's target and passes follow its drawing buffer (three sizes the target's depth
     * texture to it when it next sets it up, WebGLTextures.js 1659). */
    resize() {
      if (!glow) return;
      renderer.getDrawingBufferSize(size);
      glow.target.setSize(size.x, size.y);
      glow.bloom.setSize(size.x, size.y);
    },
    /**
     * Compiles what drawing an object needs, as the canvas pass draws it, so that it happens inside the staged build:
     * a program three cannot build throws here (a change's missing chunk, from its hook), and one the browser cannot
     * link throws its compiler's log, never in a frame. The program each material uses is judged, new or reused: three
     * keeps a program that failed to link under its key, so a second description with the same broken kind meets it.
     */
    compile(object: THREE.Object3D) {
      // A link failure is read from the program's own diagnostics below; three's console report is not needed.
      renderer.debug.onShaderError = () => undefined;
      let failure: string | undefined;
      // The variant the scene pass draws: into the glow's target while the look in force has glow.
      renderer.setRenderTarget(glow ? glow.target : null);
      try {
        for (const material of renderer.compile(object, camera, scene)) {
          const program = (renderer.properties.get(material) as Compiled).currentProgram;
          program.getUniforms();
          const {diagnostics} = program;
          if (diagnostics && !diagnostics.runnable) {
            failure ??= [diagnostics.programLog, diagnostics.vertexShader.log, diagnostics.fragmentShader.log]
              .filter(Boolean).join(' ');
          }
        }
      } finally {
        renderer.debug.onShaderError = null;
        renderer.setRenderTarget(null);
      }
      if (failure !== undefined) throw new Error(failure);
    },
    draw() {
      triangles = 0;
      if (glow) glowing(glow);
      else pass(MODEL_STAGE_LAYERS.both, null);
    },
    /** The triangles the last frame drew of the scene and the aids, as the direct draw counts them; the glow's own
     * passes are not counted. */
    get triangles() {return triangles;},
    dispose: release,
  };
}
export type ModelDraw = ReturnType<typeof createModelDraw>;
