import {modelIsRecord as object} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_SURFACE_PARAMETER, type ModelSurfaceKind} from './surfaceKindModel.ts';
import {MODEL_ACTOR_SURFACES, MODEL_SURFACE_REFUSAL, modelSurfaceValue, modelSurfaceValueFits,
  type ModelActorSurfaces, type ModelSurfaceSet} from './surfaceModel.ts';

// What an engine frame publishes for one renderer of an actor, and what an actor drawn from a surface set takes of
// it. The engine names a value by the source shader's reference name, the vocabulary of the kinds' declarations: a
// value is legal only on a parameter the renderer's kind declares, of the same type, by the rule a record's value
// meets (surfaceModel.ts). A name the frame leaves out shows the record's value.
export interface ModelMaterialOutput {
  readonly rendererId: string;
  readonly slot: number;
  readonly visible: boolean;
  readonly colors: Readonly<Record<string, readonly [number, number, number, number]>>;
  readonly floats: Readonly<Record<string, number>>;
}
/** What an actor's renderers take from a frame, by renderer id: a kind, or null for the file's own material, which
 * takes visibility and no value. An actor drawn with its file's own materials throughout lists no renderer. */
export interface ModelSurfaceTakes {readonly surfaces: ReadonlyMap<string, ModelSurfaceKind | null>}
/** The one slot of a set's renderer: a renderer is one glTF primitive, which three draws as one mesh. */
export const MODEL_RENDERER_SLOT = 0;
export const MODEL_SURFACE_OUTPUT_REFUSAL = Object.freeze({
  shape: (where: string) => `${where}: a material output states rendererId, a slot index, visible, colors and floats.`,
  color: (where: string, name: string) => `${where}, ${name}: a colour is four finite numbers.`,
  float: (where: string, name: string) => `${where}, ${name}: a float is a finite number, and this one is nonfinite.`,
  renderer: (where: string, id: string, ids: readonly string[]) =>
    `${where} names renderer ${id}; the actor's surfaces list ${ids.join(', ') || 'no renderer'}.`,
  slot: (where: string, slot: number) => `${where}: slot ${slot}; a set's renderer has the one slot 0.`,
  twice: (where: string, id: string) => `${where} names renderer ${id} twice.`,
  file: (where: string, name: string) =>
    `${where} is drawn with the file's own material, which takes no engine value; it states ${name}.`,
  undeclared: (where: string, name: string, type: string, kind: string) =>
    `${where}: kind ${kind} declares no ${type} parameter ${name}.`,
});
const refusal = MODEL_SURFACE_OUTPUT_REFUSAL;
const index = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

/** One output's shape, without its names: whole, finite, and copied, so no caller-owned array is retained. */
export function modelMaterialOutputShape(value: unknown, where: string): ModelMaterialOutput {
  if (!object(value) || typeof value.rendererId !== 'string' || !value.rendererId || !index(value.slot) ||
    typeof value.visible !== 'boolean' || !object(value.colors) || !object(value.floats)) {
    throw new ModelStageRefusal(refusal.shape(where));
  }
  const colors = Object.entries(value.colors).map(([name, components]) => {
    // Copied first: a sparse array's holes read as undefined, never skipped.
    const copy: unknown[] = Array.isArray(components) ? Array.from(components) : [];
    if (copy.length !== 4 || !copy.every(finite)) throw new ModelStageRefusal(refusal.color(where, name));
    return [name, Object.freeze(copy)] as const;
  });
  const floats = Object.entries(value.floats).map(([name, number]) => {
    if (!finite(number)) throw new ModelStageRefusal(refusal.float(where, name));
    return [name, number] as const;
  });
  return Object.freeze({rendererId: value.rendererId, slot: Number(value.slot), visible: value.visible,
    colors: Object.freeze(Object.fromEntries(colors)) as ModelMaterialOutput['colors'],
    floats: Object.freeze(Object.fromEntries(floats)) as ModelMaterialOutput['floats']});
}

function fits(output: ModelMaterialOutput, kind: ModelSurfaceKind | null, where: string) {
  const named = (form: typeof MODEL_SURFACE_PARAMETER.color | typeof MODEL_SURFACE_PARAMETER.float,
    values: Readonly<Record<string, unknown>>) => {
    for (const [name, value] of Object.entries(values)) {
      if (kind === null) throw new ModelStageRefusal(refusal.file(where, name));
      if (kind.parameters[name]?.type !== form) {
        throw new ModelStageRefusal(refusal.undeclared(where, name, form, kind.id));
      }
      const at = `${where}, kind ${kind.id}: ${name}`;
      modelSurfaceValueFits(modelSurfaceValue({[form]: value}, at), kind, name, at);
    }
  };
  named(MODEL_SURFACE_PARAMETER.color, output.colors);
  named(MODEL_SURFACE_PARAMETER.float, output.floats);
}

/** A frame's outputs for an actor, each against what its renderer takes; `where` names the entity. */
export function modelSurfaceOutputs(values: unknown, takes: ModelSurfaceTakes,
  where: string): readonly ModelMaterialOutput[] {
  if (!Array.isArray(values)) throw new ModelStageRefusal(refusal.shape(where));
  const seen = new Set<string>();
  return Object.freeze(Array.from(values, (value: unknown) => {
    const output = modelMaterialOutputShape(value, where), id = output.rendererId, kind = takes.surfaces.get(id);
    if (kind === undefined) throw new ModelStageRefusal(refusal.renderer(where, id, [...takes.surfaces.keys()]));
    const at = `${where}, renderer ${id}`;
    if (output.slot !== MODEL_RENDERER_SLOT) throw new ModelStageRefusal(refusal.slot(at, output.slot));
    if (seen.has(id)) throw new ModelStageRefusal(refusal.twice(where, id));
    seen.add(id);
    fits(output, kind, at);
    return output;
  }));
}

/** What an actor's renderers take, from its surfaces, the description's sets and the stage's kinds. */
export function modelSurfaceTakes(surfaces: ModelActorSurfaces, sets: Readonly<Record<string, ModelSurfaceSet>>,
  kinds: ReadonlyMap<string, ModelSurfaceKind>): ModelSurfaceTakes {
  if (surfaces.kind === MODEL_ACTOR_SURFACES.file) return Object.freeze({surfaces: new Map()});
  return Object.freeze({surfaces: new Map(Object.entries(sets[surfaces.set]).map(([id, entry]) => {
    if (!('values' in entry)) return [id, null];
    const kind = kinds.get(entry.kind);
    if (!kind) {
      throw new ModelStageRefusal(MODEL_SURFACE_REFUSAL.kind(`Surface set ${surfaces.set}, renderer ${id}`, entry.kind,
        [...kinds.keys()]));
    }
    return [id, kind];
  }))});
}
