import {isRecord} from '../../valueChecks.ts';
import {modelNumber, modelOption, modelRecordStating, modelStates} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// How a surface kind covers what is behind it, with no renderer: opaque; cut out; or blended, by a blend, and cut
// out as well when it states a threshold too.
export const MODEL_SURFACE_COVERAGE = Object.freeze({opaque: 'opaque', cutout: 'cutout'} as const);
/**
 * How a blended surface's colour meets what is behind it, by the names of URP's `_Blend` (BaseShaderGUI.cs:1044-1092):
 * `alpha`, the colour weighted by its alpha (SrcAlpha, OneMinusSrcAlpha); `premultiply`, the colour as the surface
 * writes it, its alpha already in it (One, OneMinusSrcAlpha). The alpha itself blends One, OneMinusSrcAlpha in both.
 */
export const MODEL_SURFACE_BLEND = Object.freeze({alpha: 'alpha', premultiply: 'premultiply'} as const);
export type ModelSurfaceBlend = typeof MODEL_SURFACE_BLEND[keyof typeof MODEL_SURFACE_BLEND];
/** A cut-out at a threshold: a declared float's name, or a number from 0 to 1. Below it the surface is cut away. */
export interface ModelSurfaceCutout {readonly cutout: string | number}
/** A blended surface: sorted, blended by its blend, and writing no depth. */
export interface ModelSurfaceBlended {readonly blend: ModelSurfaceBlend}
export type ModelSurfaceCoverage = typeof MODEL_SURFACE_COVERAGE[keyof typeof MODEL_SURFACE_COVERAGE] |
  ModelSurfaceCutout | ModelSurfaceBlended | (ModelSurfaceCutout & ModelSurfaceBlended);
const FIELDS = Object.freeze({stated: [], whenStated: ['cutout', 'blend']});
export const MODEL_SURFACE_COVERAGE_REFUSAL = Object.freeze({
  coverage: (where: string) => `${where} is one of ${Object.values(MODEL_SURFACE_COVERAGE).join(', ')}, or a ` +
    `record stating a cutout (a declared float or a number from 0 to 1), a blend (one of ` +
    `${Object.values(MODEL_SURFACE_BLEND).join(', ')}), or both.`,
});

/** A kind's coverage, checked; `float` checks that a name is one of the kind's declared floats. */
export function modelSurfaceCoverage(value: unknown, at: string,
  float: (name: unknown, at: string) => string): ModelSurfaceCoverage {
  if (!isRecord(value)) {
    if (Object.values<unknown>(MODEL_SURFACE_COVERAGE).includes(value)) {
      return modelOption(value, MODEL_SURFACE_COVERAGE, at);
    }
    throw new ModelStageRefusal(MODEL_SURFACE_COVERAGE_REFUSAL.coverage(at));
  }
  const record = modelRecordStating(value, FIELDS, at);
  const cuts = modelStates(record, 'cutout'), blends = modelStates(record, 'blend');
  if (!cuts && !blends) throw new ModelStageRefusal(MODEL_SURFACE_COVERAGE_REFUSAL.coverage(at));
  const cutout = () => typeof record.cutout === 'number' ? modelNumber(record.cutout, `${at}.cutout`, 0, 1) :
    float(record.cutout, `${at}.cutout`);
  const blend = () => modelOption(record.blend, MODEL_SURFACE_BLEND, `${at}.blend`);
  if (cuts && blends) return Object.freeze({cutout: cutout(), blend: blend()});
  return Object.freeze(cuts ? {cutout: cutout()} : {blend: blend()});
}
