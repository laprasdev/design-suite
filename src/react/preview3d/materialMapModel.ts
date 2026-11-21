import {isRecord} from '../../valueChecks.ts';
import {modelColor, type ModelColor} from './colorModel.ts';
import {modelEntries, modelFlag, modelName, modelOption, modelRecordStating, modelStates} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_COLOR_SPACE, type ModelColorSpace} from './surfaceKindModel.ts';

// Per-actor material-map overrides, validated without three: a host supplies a browser image source per named
// standard material, or null to restore the file's own materials.
export interface ModelActorMaterialMap {
  readonly image: TexImageSource;
  readonly colorSpace?: ModelColorSpace;
  readonly flipY?: boolean;
  readonly color?: ModelColor;
}
export const MODEL_MATERIAL_MAP_REFUSAL = Object.freeze({
  image: (where: string) => `${where} must be a non-null image object.`,
});
const FIELDS = Object.freeze({stated: ['image'], whenStated: ['colorSpace', 'flipY', 'color']});
const isImage = (value: unknown): value is TexImageSource => isRecord(value);

function mapEntry(value: unknown, where: string): ModelActorMaterialMap {
  const record = modelRecordStating(value, FIELDS, where);
  if (!isImage(record.image)) throw new ModelStageRefusal(MODEL_MATERIAL_MAP_REFUSAL.image(`${where}.image`));
  return Object.freeze({
    image: record.image,
    ...(modelStates(record, 'colorSpace') && {
      colorSpace: modelOption(record.colorSpace, MODEL_COLOR_SPACE, `${where}.colorSpace`),
    }),
    ...(modelStates(record, 'flipY') && {flipY: modelFlag(record.flipY, `${where}.flipY`)}),
    ...(modelStates(record, 'color') && {color: modelColor(record.color, `${where}.color`)}),
  });
}

/** Per-material texture overrides keyed by non-empty material name, or null to clear them. */
export function modelActorMaterialMaps(value: unknown, where: string):
  Readonly<Record<string, ModelActorMaterialMap>> | null {
  if (value === null) return null;
  const entries = modelEntries(value, where, 'material maps by material name').map(([name, entry]):
    [string, ModelActorMaterialMap] => {
    const valid = modelName(name, `${where} material name`);
    return [valid, mapEntry(entry, `${where}.${valid}`)];
  });
  return Object.freeze(Object.fromEntries(entries));
}
