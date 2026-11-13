import * as THREE from 'three';
import {MODEL_STAGE_TONE_CURVE, type ModelStageGlow, type ModelStageToneCurve} from './lookModel.ts';
import type {ModelStageCommit} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_STAGE_LAYERS} from './layers.ts';
import {createModelGlow, type ModelGlow, type ModelGlowPasses} from './glow.ts';

const CURVES: Readonly<Record<ModelStageToneCurve, THREE.ToneMapping>> = Object.freeze({
  [MODEL_STAGE_TONE_CURVE.acesFilmic]: THREE.ACESFilmicToneMapping,
});
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
/** What the frame's draw is given beside three's renderer, scene and camera. */
export interface ModelDrawContext {
  /** Fetches the glow's passes (`loadModelGlowPasses`); asked once, again only after a fetch that failed. */
  readonly loadPasses: () => Promise<ModelGlowPasses>;
  /** Whether a Surface mode other than Lit is in force: the frame then shows a term of each surface, as stated, so it
   * is drawn straight to the canvas without the look's glow (materials.ts). */
  readonly inspecting: () => boolean;
}

/**
 * The frame's one draw. Without glow (or while a Surface mode inspects) it is the scene, aids included, through the
 * camera to the canvas under the look's tone curve or none, exactly as three draws it. With glow the scene's look is
 * drawn once, in linear light, into a multisampled half-float target, resolved once; three's bloom pass reads it and
 * composites its bloom into its own target; one output pass adds the bloom to the scene and writes the canvas through
 * the look's tone curve and the display encoding, and the target's depth; the stage's aids are drawn last, untoned,
 * behind the scene where it is in front of them. Nothing draws into the target after its one resolve (so the headset
 * browser, which discards a multisampled target's colour after a resolve, draws it whole). No material changes program
 * between frames.
 */
export function createModelDraw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  context: ModelDrawContext) {
  const size = new THREE.Vector2();
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
  // The canvas is drawn under the look's curve (set as the frame starts): the direct draw's materials, or the output
  // pass under glow; three applies no curve inside a target, and the aids after the output pass are drawn uncurved.
  const glowing = (value: ModelGlow) => {
    pass(MODEL_STAGE_LAYERS.scene, value.target);
    value.bloom(renderer);
    renderer.setRenderTarget(null);
    value.output(renderer);
    renderer.toneMapping = THREE.NoToneMapping;
    const clears = renderer.autoClear;
    renderer.autoClear = false;
    pass(MODEL_STAGE_LAYERS.aids, null);
    renderer.autoClear = clears;
  };
  const bloom = (value: ModelStageGlow, loaded: ModelGlowPasses) => {
    glow ??= createModelGlow(loaded, renderer.getDrawingBufferSize(size));
    glow.set(value);
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
      loading ??= context.loadPasses().then(loaded => {passes = loaded;}, (error: unknown) => {
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
    /** The canvas changed size: the glow's target and passes follow its drawing buffer. */
    resize() {
      if (!glow) return;
      renderer.getDrawingBufferSize(size);
      glow.resize(size.x, size.y);
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
      // The variant the scene pass draws: into the glow's target while the look in force glows and nothing inspects.
      renderer.setRenderTarget(glow && !context.inspecting() ? glow.target : null);
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
      renderer.toneMapping = curve;
      if (glow && !context.inspecting()) glowing(glow);
      else pass(MODEL_STAGE_LAYERS.both, null);
    },
    /** The triangles the last frame drew of the scene and the aids, as the direct draw counts them; the glow's own
     * passes are not counted. */
    get triangles() {return triangles;},
    dispose: release,
  };
}
export type ModelDraw = ReturnType<typeof createModelDraw>;
