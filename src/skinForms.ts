import type {ComponentSkin} from './skinAssignments.ts';
import {KnobSkinForm, SkinKind, type DefaultedKind} from './skinKinds.ts';
import {KnobForm, KnobFeature, KnobPreset, KnobStroke, type KnobConfig, type KnobFeatureValue, type KnobLayoutValue,
  type KnobPresetKey} from './synth/design/constants/KnobConfig.ts';

/** One presentation lookup. Semantic kinds, values and limits remain the caller's inputs. */
export const skinForm = (skin: ComponentSkin | undefined, kind: string): string | undefined =>
  skin?.active[kind];
/** The skin's form, or the kind's one default where the skin names none. Callers that need "none" use skinForm. */
export const skinFormOrDefault = (skin: ComponentSkin | undefined, {kind, form}: DefaultedKind): string =>
  skinForm(skin, kind) ?? form;

const KNOB_VISUAL_FEATURES: readonly KnobFeatureValue[] =
  [KnobFeature.TICKS, KnobFeature.CENTER_DOT, KnobFeature.LINE_INDICATOR];
export function knobSkinConfig(base: KnobConfig, option?: string): KnobConfig {
  if (!option) return base;
  const features = new Set([...base.features].filter(feature => !KNOB_VISUAL_FEATURES.includes(feature)));
  if (option === KnobSkinForm.TICKS) {features.add(KnobFeature.TICKS); features.add(KnobFeature.CENTER_DOT);}
  else features.add(KnobFeature.LINE_INDICATOR);
  return {...base, features, stroke: option === KnobSkinForm.FINE ? KnobStroke.THIN : KnobStroke.STANDARD,
    form: option === KnobSkinForm.CUTOUT ? KnobForm.CUTOUT
      : option === KnobSkinForm.MINIMAL ? KnobForm.THIN : KnobForm.CLASSIC};
}

/** The config a knob's props name: a preset or a whole config, and the size and layout they override in it. */
export interface KnobConfigProps {
  /** Use a preset configuration */
  preset?: KnobPresetKey;
  /** Or provide a full config object */
  config?: KnobConfig;
  /** Override individual config properties */
  size?: number;
  layout?: KnobLayoutValue;
}

/** A knob's config from its props: its own config, or the preset they name (else its kind's), in the skin's knob form
 *  unless its own config names a form, at the size and layout the props override. */
export function knobConfigFromProps(skin: ComponentSkin | undefined, {preset, config, size, layout}: KnobConfigProps,
  kindPreset: KnobPresetKey): KnobConfig {
  const base = knobSkinConfig(config ?? KnobPreset[preset ?? kindPreset],
    config?.form ? undefined : skinForm(skin, SkinKind.KNOB));
  return {...base, size: size ?? base.size, layout: layout ?? base.layout};
}
