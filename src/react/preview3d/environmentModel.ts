import {modelColor, type ModelColor} from './colorModel.ts';
import {modelPresentationRotation, modelPresentationVector, type ModelRotation, type ModelVector}
  from './placementModel.ts';
import {modelFlag, modelName, modelNumber, modelNumbers, modelRecord, modelRecordStating, modelStates}
  from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// The description's environment, with no renderer: a ground plane (with an optional grid) and boxes, each one colour.
// It takes no kind, now or later (when scenes arrive every placed thing is an actor and the boxes go). Every record is
// exact; a box's rotation and the plane's grid are each stated or left out.
export const MODEL_ENVIRONMENT_GRID = Object.freeze({maximumLines: 1024, elevation: 0.001});
export interface ModelEnvironmentBox {
  readonly id: string;
  readonly position: ModelVector;
  readonly size: ModelVector;
  readonly color: ModelColor;
  readonly rotationQuaternion?: ModelRotation;
}
export interface ModelEnvironment {
  readonly reflectZ: boolean;
  readonly plane: {readonly position: ModelVector; readonly size: readonly [number, number];
    readonly color: ModelColor; readonly grid?: {readonly spacing: number; readonly color: ModelColor}} | null;
  readonly boxes: readonly ModelEnvironmentBox[];
}
const FIELDS = Object.freeze({environment: ['reflectZ', 'plane', 'boxes'], grid: ['spacing', 'color'],
  plane: {stated: ['position', 'size', 'color'], whenStated: ['grid']},
  box: {stated: ['id', 'position', 'size', 'color'], whenStated: ['rotationQuaternion']}});
export const MODEL_ENVIRONMENT_REFUSAL = Object.freeze({
  boxes: (where: string) => `${where} is a list of boxes, empty for none.`,
  repeated: (where: string, id: string) => `${where}: box ${id} is declared twice.`,
  positive: (where: string) => `${where} must be greater than 0.`,
  lines: (where: string, count: number) =>
    `${where} draws ${count} lines; a grid draws at most ${MODEL_ENVIRONMENT_GRID.maximumLines}.`,
});
const refusal = MODEL_ENVIRONMENT_REFUSAL, WHERE = 'The environment';

function dimensions(value: unknown, length: number, where: string) {
  const result = modelNumbers(value, length, where);
  if (result.some(number => number <= 0)) throw new ModelStageRefusal(refusal.positive(where));
  return Object.freeze(result);
}
function grid(value: unknown, size: readonly number[], where: string) {
  const record = modelRecord(value, FIELDS.grid, where);
  const spacing = modelNumber(record.spacing, `${where}.spacing`, 0, Number.POSITIVE_INFINITY);
  if (!(spacing > 0)) throw new ModelStageRefusal(refusal.positive(`${where}.spacing`));
  const count = size.reduce((total, dimension) => total + Math.floor(dimension / spacing) + 1, 0);
  if (count > MODEL_ENVIRONMENT_GRID.maximumLines) throw new ModelStageRefusal(refusal.lines(where, count));
  return Object.freeze({spacing, color: modelColor(record.color, `${where}.color`)});
}
function plane(value: unknown, where: string): NonNullable<ModelEnvironment['plane']> {
  const record = modelRecordStating(value, FIELDS.plane, where);
  const size = dimensions(record.size, 2, `${where}.size`) as unknown as readonly [number, number];
  return Object.freeze({position: modelPresentationVector(record.position, `${where}.position`), size,
    color: modelColor(record.color, `${where}.color`),
    ...(modelStates(record, 'grid') && {grid: grid(record.grid, size, `${where}.grid`)})});
}
function box(value: unknown, where: string): ModelEnvironmentBox {
  const record = modelRecordStating(value, FIELDS.box, where);
  return Object.freeze({id: modelName(record.id, `${where}.id`),
    position: modelPresentationVector(record.position, `${where}.position`),
    size: dimensions(record.size, 3, `${where}.size`) as unknown as ModelVector,
    color: modelColor(record.color, `${where}.color`),
    ...(modelStates(record, 'rotationQuaternion') && {
      rotationQuaternion: modelPresentationRotation(record.rotationQuaternion, `${where}.rotationQuaternion`)})});
}

/** A description's environment, checked whole; null, the explicit "none", is the description's to state. */
export function modelEnvironment(value: unknown): ModelEnvironment {
  const record = modelRecord(value, FIELDS.environment, WHERE);
  const reflectZ = modelFlag(record.reflectZ, `${WHERE}.reflectZ`);
  if (!Array.isArray(record.boxes)) throw new ModelStageRefusal(refusal.boxes(`${WHERE}.boxes`));
  const ids = new Set<string>();
  const boxes = Array.from(record.boxes, (entry: unknown, index) => {
    const next = box(entry, `${WHERE}.boxes[${index}]`);
    if (ids.has(next.id)) throw new ModelStageRefusal(refusal.repeated(`${WHERE}.boxes[${index}]`, next.id));
    ids.add(next.id);
    return next;
  });
  return Object.freeze({reflectZ, plane: record.plane === null ? null : plane(record.plane, `${WHERE}.plane`),
    boxes: Object.freeze(boxes)});
}
