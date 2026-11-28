import {modelEntries} from './recordModel.ts';
import {modelStatedRecord} from './statedValueModel.ts';
import {ModelStageUndrawn} from './refusal.ts';
import {MODEL_NO_EMITTERS, type ModelEmitterDrawing, type ModelEmitterProfile, type ModelEmitterRecord,
  type ModelEmitterRecords, type ModelEmitterSkip} from './emitterModel.ts';
import {modelEmitterProfile} from './emitterProfileModel.ts';

// An actor's emitter records as the description holds them, and what the stage draws of them, read once together.
const BY_ID = 'emitter profiles by id';
const NOTHING_DRAWN: ModelEmitterDrawing = Object.freeze({drawn: Object.freeze({}), skipped: Object.freeze([])});
// Each records object `modelEmitterRecords` returns, with what the stage draws of it, read once as it was checked.
const DRAWINGS = new WeakMap<ModelEmitterRecords, ModelEmitterDrawing>([[MODEL_NO_EMITTERS, NOTHING_DRAWN]]);
/** Actor `actor`'s records, by the id the engine's frame names them by, each checked whole by drawing its profile, then
 * kept as stated, so a description read again reads as itself. A profile holding a value the stage does not draw yet
 * (`ModelStageUndrawn`) is skipped with that refusal and the rest drawn; any other failure refuses the records. */
export function modelEmitterRecords(actor: string, value: unknown): ModelEmitterRecords {
  const where = `Actor ${actor}.emitters`, records: Record<string, ModelEmitterRecord> = {};
  const drawn: Record<string, ModelEmitterProfile> = {}, skipped: ModelEmitterSkip[] = [];
  for (const [profile, record] of modelEntries(value, where, BY_ID)) {
    const at = `${where}.${profile}`;
    try {
      drawn[profile] = modelEmitterProfile(record, at);
    } catch (error) {
      if (!(error instanceof ModelStageUndrawn)) throw error;
      skipped.push(Object.freeze({actor, profile, setting: error.where.slice(at.length + 1), refusal: error.message}));
    }
    records[profile] = modelStatedRecord(record, at);
  }
  const read = Object.freeze(records);
  DRAWINGS.set(read, Object.freeze({drawn: Object.freeze(drawn), skipped: Object.freeze(skipped)}));
  return read;
}
/** What the stage draws of records `modelEmitterRecords` read, and each profile it skips. */
export function modelEmitterDrawing(records: ModelEmitterRecords): ModelEmitterDrawing {
  const drawing = DRAWINGS.get(records);
  if (!drawing) throw new Error('Emitter records reach the stage only as modelEmitterRecords read them.');
  return drawing;
}
