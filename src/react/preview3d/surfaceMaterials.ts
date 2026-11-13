import * as THREE from 'three';
import type {ModelFileReader} from './files.ts';
import {createModelFileCache} from './fileCache.ts';
import {createModelSurfaceProgram, modelSurfaceSlots, MODEL_SURFACE_GLSL,
  type ModelSurfaceProgram, type ModelSurfaceSlot} from './surfaceProgram.ts';
import {MODEL_SURFACE_PARAMETER, type ModelSurfaceKind} from './surfaceKindModel.ts';
import type {ModelSurfaceRecord, ModelSurfaceValue} from './surfaceModel.ts';
import type {ModelTextures} from './textures.ts';
import type {ModelStageSharedValues} from './sharedValues.ts';
import {extendModelMaterial} from './shading.ts';
import type {ModelStageChanges} from './materials.ts';
import {writeModelSurfaceColor} from './color.ts';

// The stage's kind materials: one per record (a kind and its values), built the first time a renderer needs it and
// shared by every renderer that declares the same record, whichever actor it belongs to; never cloned and never
// disposed with an actor. A record's values are written once, when its material is built, into the values the program
// reads; a renderer the engine gives values of its own draws them through its own copy (actorSurfaces.ts). Users are
// counted by the actors that draw with a material, and `sweep`, after a description is applied, frees what none use.
export interface ModelSurfaceMaterial {
  readonly material: THREE.ShaderMaterial;
  readonly kind: ModelSurfaceKind;
  readonly slots: ReadonlyMap<string, ModelSurfaceSlot>;
  /** The record's values in the kind's slots, as the program reads them: what a renderer shows when no engine value
   * stands for it. */
  readonly declared: Float32Array;
}
export interface ModelSurfaceMaterialsContext {
  readonly kinds: ReadonlyMap<string, ModelSurfaceKind>;
  readonly read: ModelFileReader;
  readonly textures: Pick<ModelTextures, 'acquire' | 'release'>;
  readonly shared: Pick<ModelStageSharedValues, 'uniforms' | 'declarations'>;
  /** The stage's changes a model material takes: its fog, and its Surface mode where the mode covers the program. */
  readonly changes: ModelStageChanges;
}
export const MODEL_SURFACE_MATERIALS_TEXT = Object.freeze({
  unknown: (kind: string) => `A material was asked for kind ${kind}, which the stage was not given.`,
});
const SLOT = 4;
/** A constant texture is one texel, sampled as it is: scale 1, offset 0. */
const AS_IT_IS = Object.freeze([1, 1, 0, 0]);

function write(declared: Float32Array, slot: ModelSurfaceSlot, value: ModelSurfaceValue) {
  const at = slot.index * SLOT, {parameter} = slot;
  if ('color' in value && parameter.type === MODEL_SURFACE_PARAMETER.color) {
    writeModelSurfaceColor(declared, at, value.color, parameter.space);
  } else if ('vector' in value) declared.set(value.vector, at);
  else if ('float' in value) declared[at] = value.float;
  else if ('keyword' in value) declared[at] = value.keyword ? 1 : 0;
  else if ('texture' in value && 'scale' in value.texture) {
    declared.set(value.texture.scale, at);
    declared.set(value.texture.offset, at + 2);
  } else declared.set(AS_IT_IS, at);
}

export function createModelSurfaceMaterials(context: ModelSurfaceMaterialsContext) {
  // A kind's program text is read once; once composed into its kind's program it is not needed again.
  const programs = createModelFileCache<string>(context.read, {what: 'web program of a surface kind',
    decode: async bytes => new TextDecoder().decode(bytes), free: () => undefined, used: () => false});
  const webPrograms = (records: readonly ModelSurfaceRecord[]) => [...new Set(records.flatMap(record =>
    context.kinds.get(record.kind) ?? []))].map(kind => kind.webProgram);
  const composed = new Map<string, ModelSurfaceProgram>();
  type Built = {readonly key: string; readonly surface: ModelSurfaceMaterial; readonly textures: THREE.Texture[];
    users: number};
  const built = new Map<string, Built>(), counted = new Map<ModelSurfaceMaterial, Built>();
  const made = new WeakSet<THREE.Material>();
  const kindOf = (record: ModelSurfaceRecord) => {
    const kind = context.kinds.get(record.kind);
    if (!kind) throw new Error(MODEL_SURFACE_MATERIALS_TEXT.unknown(record.kind));
    return kind;
  };
  const program = (kind: ModelSurfaceKind) => {
    const held = composed.get(kind.id);
    if (held) return held;
    const fresh = createModelSurfaceProgram(kind, programs.get(kind.webProgram), context.shared.declarations);
    composed.set(kind.id, fresh);
    return fresh;
  };
  const build = (key: string, record: ModelSurfaceRecord): Built => {
    const kind = kindOf(record), slots = modelSurfaceSlots(kind), composedProgram = program(kind);
    const declared = new Float32Array(SLOT * slots.size), textures: THREE.Texture[] = [];
    const uniforms: Record<string, THREE.IUniform> = {...composedProgram.baseUniforms(), ...context.shared.uniforms,
      [MODEL_SURFACE_GLSL.values]: {value: declared}};
    for (const slot of slots.values()) {
      const value = record.values[slot.name];
      write(declared, slot, value);
      if (!('texture' in value) || slot.parameter.type !== MODEL_SURFACE_PARAMETER.texture) continue;
      const texture = context.textures.acquire(value.texture, slot.parameter.space);
      textures.push(texture);
      uniforms[`${MODEL_SURFACE_GLSL.texture}${slot.name}`] = {value: texture};
    }
    const fresh = composedProgram.make(uniforms), material = extendModelMaterial(fresh, context.changes(fresh));
    material.name = `surface kind ${kind.id}`;
    made.add(material);
    const entry = {key, surface: Object.freeze({material, kind, slots, declared}), textures, users: 0};
    built.set(key, entry);
    counted.set(entry.surface, entry);
    return entry;
  };
  const sweep = () => {
    for (const entry of built.values()) {
      if (entry.users > 0) continue;
      built.delete(entry.key);
      counted.delete(entry.surface);
      entry.surface.material.dispose();
      for (const texture of entry.textures) context.textures.release(texture);
    }
  };
  return {
    /** A staged load of what drawing these records needs: the web program of each of their kinds, read once. The
     * records were checked against the kinds before (stageParts.ts), so each names a kind the stage was given. */
    load: (records: readonly ModelSurfaceRecord[]) => programs.load(webPrograms(records)),
    /** The description in force draws these records: the programs of their kinds stay, any other is freed. */
    keep: (records: readonly ModelSurfaceRecord[]) => programs.keep(webPrograms(records)),
    /** The material of a record, built the first time it is asked for; it counts no user until one draws with it. */
    material(record: ModelSurfaceRecord): ModelSurfaceMaterial {
      const key = JSON.stringify(record);
      return (built.get(key) ?? build(key, record)).surface;
    },
    use(surface: ModelSurfaceMaterial) {counted.get(surface)!.users++;},
    unuse(surface: ModelSurfaceMaterial) {counted.get(surface)!.users--;},
    /** Every material no actor draws with is freed, and the textures it held released. */
    sweep,
    /** Whether a material is one of the stage's kind materials. */
    made: (material: THREE.Material) => made.has(material),
    dispose() {
      for (const entry of built.values()) entry.users = 0;
      sweep();
      programs.dispose();
    },
  };
}
export type ModelSurfaceMaterials = ReturnType<typeof createModelSurfaceMaterials>;
