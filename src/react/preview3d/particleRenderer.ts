import * as THREE from 'three';
import {BatchedRenderer, RenderMode, type VFXBatch, type VFXBatchSettings} from 'three.quarks';
import {MODEL_EMITTER_RENDER} from './emitterSystems.ts';
import {extendModelMaterial, modelShaderChunk, type ModelShaderChange} from './shading.ts';

// The stage's one stepper and drawer of particles: three.quarks' batched renderer, each batch's program taking the
// stage's fog through the stage's one owner of program changes (shading.ts). quarks' particle programs carry none of
// three's fog chunks, so the first change places them at chunks quarks' programs do carry, after three's
// <begin_vertex>, which declares the position the fog's height reads (`transformed`, set to the particle's in the
// batch's space) and is where the stage sets the object's world transform (surfaceReads.ts); the stage's fog change
// then applies to them as to any material.
export const MODEL_PARTICLE_FOG_ANCHORS = 'model-particle-fog-anchors';
export const MODEL_PARTICLE_TEXT = Object.freeze({
  program: (mode: RenderMode) => `three.quarks batches of render mode ${mode} are not drawn by the stage; it draws ` +
    `billboards and meshes in quarks' own unlit program.`,
});
const CHUNK = Object.freeze({parsVertex: 'logdepthbuf_pars_vertex', vertex: 'logdepthbuf_vertex',
  parsFragment: 'logdepthbuf_pars_fragment', toneMapping: 'tonemapping_fragment'});
const after = (chunk: string, lines: string) => `${modelShaderChunk(chunk)}\n${lines}`;

function fogAnchors(mode: RenderMode, uniforms: Record<string, THREE.IUniform>): ModelShaderChange {
  const drawn = Object.values(MODEL_EMITTER_RENDER).find(render => render.mode === mode);
  if (drawn === undefined) throw new Error(MODEL_PARTICLE_TEXT.program(mode));
  const {transformed} = drawn;
  return {key: `${MODEL_PARTICLE_FOG_ANCHORS}-${mode}`, apply(shader, replace) {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = replace(replace(shader.vertexShader, CHUNK.parsVertex,
      after(CHUNK.parsVertex, modelShaderChunk('fog_pars_vertex'))), CHUNK.vertex,
    after(CHUNK.vertex, `${modelShaderChunk('begin_vertex')}\ntransformed = ${transformed};\n${
      modelShaderChunk('fog_vertex')}`));
    shader.fragmentShader = replace(replace(shader.fragmentShader, CHUNK.parsFragment,
      after(CHUNK.parsFragment, modelShaderChunk('fog_pars_fragment'))), CHUNK.toneMapping,
    `${modelShaderChunk('fog_fragment')}\n${modelShaderChunk(CHUNK.toneMapping)}`);
  }};
}

class ModelParticleRenderer extends BatchedRenderer {
  // three's own fog uniforms, which it writes for a material that takes fog; one set every batch shares.
  readonly #uniforms = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
  readonly #fog: ModelShaderChange;
  constructor(fog: ModelShaderChange) {
    super();
    this.#fog = fog;
  }
  protected override createBatch(settings: VFXBatchSettings): VFXBatch {
    const batch = super.createBatch(settings), {material} = batch;
    if (!(material instanceof THREE.ShaderMaterial)) throw new Error(MODEL_PARTICLE_TEXT.program(settings.renderMode));
    material.fog = true;
    extendModelMaterial(material, [fogAnchors(settings.renderMode, this.#uniforms), this.#fog]);
    return batch;
  }
}

/** The stage's particle renderer, its batches taking the stage's fog change `fog` (fog.ts). */
export const createModelParticleRenderer = (fog: ModelShaderChange): BatchedRenderer => new ModelParticleRenderer(fog);
