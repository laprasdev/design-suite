import * as THREE from 'three';
import {MODEL_STAGE_CURVE, type ModelStageCurve, type ModelStageGlow, type ModelStageOutput} from './lookModel.ts';
import type {ModelStageCommit} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_STAGE_LAYERS} from './layers.ts';
import {createModelGlow, type ModelGlow, type ModelGlowPasses} from './glow.ts';
import {createModelLinearFrame} from './linearFrame.ts';
import type {ModelSurfaceModes} from './materials.ts';

const CURVES: Readonly<Record<ModelStageCurve, THREE.ToneMapping>> = Object.freeze({
  [MODEL_STAGE_CURVE.acesFilmic]: THREE.ACESFilmicToneMapping,
});
// What three must offer the frame: a colour buffer of half floats, for the linear frame and the bloom's own targets.
const HALF_FLOAT = Object.freeze(['EXT_color_buffer_float', 'EXT_color_buffer_half_float']);
export const MODEL_DRAW_TEXT = Object.freeze({
  halfFloat: 'The stage draws its frame in linear light into a half-float target; this browser\'s WebGL has none.',
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
/** What the frame's draw is given beside three's renderer, scene and camera. */
export interface ModelDrawContext {
  /** Fetches the glow's pass (`loadModelGlowPasses`); asked once, again only after a fetch that failed. */
  readonly loadPasses: () => Promise<ModelGlowPasses>;
  /** What the Surface mode in force asks of the frame: no glow while it inspects, no curve unless it is curved. */
  readonly modes: Pick<ModelSurfaceModes, 'inspecting' | 'curved'>;
}

/**
 * The frame's one draw. The scene's look is drawn once, in linear light, into a multisampled half-float target,
 * resolved once, so every blended surface mixes with what is behind it in linear light, as URP's does. With glow (and
 * no Surface mode inspecting) three's bloom pass reads it and composites its bloom into its own target. One output pass
 * writes the canvas, with the bloom added where it is drawn, through the look's tone curve (unless the mode shows its
 * term untoned) and the display encoding, and the target's depth; the stage's aids are drawn last, untoned, behind the
 * scene where it is in front of them. Nothing draws into the target after its one resolve (so the headset browser,
 * which discards a multisampled target's colour after a resolve, draws it whole). No material changes program between
 * frames.
 */
export function createModelDraw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  context: ModelDrawContext) {
  if (!HALF_FLOAT.some(name => renderer.extensions.has(name))) throw new ModelStageRefusal(MODEL_DRAW_TEXT.halfFloat);
  const size = new THREE.Vector2();
  const frame = createModelLinearFrame(renderer.getDrawingBufferSize(size));
  let passes: ModelGlowPasses | undefined, loading: Promise<void> | undefined;
  let glow: ModelGlow | undefined, curve = THREE.NoToneMapping as THREE.ToneMapping;
  let triangles = 0;
  const release = () => {
    glow?.dispose();
    glow = undefined;
  };
  const pass = (mask: number, into: THREE.WebGLRenderTarget | null) => {
    camera.layers.mask = mask;
    renderer.setRenderTarget(into);
    renderer.render(scene, camera);
    triangles += renderer.info.render.triangles;
  };
  // three applies no curve inside a target: the output pass is drawn under the look's curve (or none, as the mode
  // asks), and the aids after it uncurved.
  const output = (drawn: ModelGlow | undefined) => {
    drawn?.render(renderer, frame.target);
    frame.setGlow(drawn ? drawn.texture : null);
    renderer.setRenderTarget(null);
    renderer.toneMapping = context.modes.curved ? curve : THREE.NoToneMapping;
    frame.output(renderer);
    renderer.toneMapping = THREE.NoToneMapping;
  };
  // The curve and exposure the output pass draws under. Under no curve three reads no exposure (its tonemapping chunk
  // is compiled only under a curve).
  const apply = ({toneCurve}: ModelStageOutput) => {
    curve = toneCurve === null ? THREE.NoToneMapping : CURVES[toneCurve.curve];
    if (toneCurve !== null) renderer.toneMappingExposure = toneCurve.exposure;
  };
  return {
    /** What drawing this glow needs loaded first: the glow's passes, fetched once, when a look first brings glow;
     * `where` names the glow in a refusal. */
    load(value: ModelStageGlow | null, where: string): readonly Promise<void>[] {
      if (value === null || passes) return [];
      loading ??= context.loadPasses().then(loaded => {passes = loaded;}, (error: unknown) => {
        loading = undefined;
        throw new ModelStageRefusal(MODEL_DRAW_TEXT.passes(where, error instanceof Error ? error.message :
          String(error)), {cause: error});
      });
      return [loading];
    },
    /** A look's tone curve and glow, checked. */
    prepare(look: ModelStageOutput): ModelStageCommit {
      const value = look.glow;
      if (value === null) return () => {apply(look); release();};
      const loaded = passes;
      if (!loaded) throw new Error(MODEL_DRAW_TEXT.unloaded);
      return () => {
        apply(look);
        glow ??= createModelGlow(loaded, renderer.getDrawingBufferSize(size));
        glow.set(value);
      };
    },
    /** The canvas is to be this many CSS pixels. Its drawing buffer is three's: the size times the pixel ratio,
     * rounded down (WebGLRenderer.js 632). The frame takes it first, so a size past its budget is refused before the
     * canvas changes; then the canvas and the glow's passes follow it. */
    resize(width: number, height: number) {
      const ratio = renderer.getPixelRatio();
      size.set(Math.floor(width * ratio), Math.floor(height * ratio));
      frame.resize(size.x, size.y);
      renderer.setSize(width, height, false);
      glow?.resize(size.x, size.y);
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
      // The variant the scene pass draws: into the frame's target.
      renderer.setRenderTarget(frame.target);
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
      pass(MODEL_STAGE_LAYERS.scene, frame.target);
      output(context.modes.inspecting ? undefined : glow);
      const clears = renderer.autoClear;
      renderer.autoClear = false;
      pass(MODEL_STAGE_LAYERS.aids, null);
      renderer.autoClear = clears;
    },
    /** The triangles the last frame drew of the scene and the aids; the output pass and the glow's are not counted. */
    get triangles() {return triangles;},
    dispose() {
      release();
      frame.dispose();
    },
  };
}
export type ModelDraw = ReturnType<typeof createModelDraw>;
