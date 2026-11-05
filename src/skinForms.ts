import type {ComponentSkin} from './skinAssignments.ts';
import {KnobForm, KnobFeature, KnobStroke, type KnobConfig, type KnobFeatureValue}
  from './synth/design/constants/KnobConfig.ts';

/** One presentation lookup. Semantic kinds, values and limits remain the caller's inputs. */
export const skinForm = (skin: ComponentSkin | undefined, kind: string) => skin?.active[kind];

const KNOB_VISUAL_FEATURES: readonly KnobFeatureValue[] =
  [KnobFeature.TICKS, KnobFeature.CENTER_DOT, KnobFeature.LINE_INDICATOR];
export function knobSkinConfig(base: KnobConfig, option?: string): KnobConfig {
  if (!option) return base;
  const features = new Set([...base.features].filter(feature => !KNOB_VISUAL_FEATURES.includes(feature)));
  if (option === 'ticks') {features.add(KnobFeature.TICKS); features.add(KnobFeature.CENTER_DOT);}
  else features.add(KnobFeature.LINE_INDICATOR);
  return {...base, features, stroke: option === 'fine' ? KnobStroke.THIN : KnobStroke.STANDARD,
    form: option === 'cutout' ? KnobForm.CUTOUT : option === 'minimal' ? KnobForm.THIN : KnobForm.CLASSIC};
}
