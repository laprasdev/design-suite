import {ModelStageRefusal} from './refusal.ts';

// The stage's colour data, with no renderer: an sRGB triple, each component in [0, 1], as the environment and the
// look state it; and the one reading of a `#rrggbb` string into it. That reading is byte / 255, the arithmetic three's
// own hex parse does, so a colour read here and the colour three reads from the same string are the same numbers.
export type ModelColor = readonly [number, number, number];
const HEX = /^#[0-9a-f]{6}$/i;
const BYTE = 0xff, RED = 16, GREEN = 8;
export const MODEL_COLOR_REFUSAL = Object.freeze({
  color: (name: string) => `${name} must be three finite numbers, sRGB in [0, 1].`,
  hex: (name: string, value: string) => `${name} must be a #rrggbb colour; it is ${value}.`,
});

export function modelColor(value: unknown, name: string): ModelColor {
  const copy: unknown[] = Array.isArray(value) ? Array.from(value) : [];
  const unit = (component: unknown): component is number =>
    typeof component === 'number' && component >= 0 && component <= 1;
  if (copy.length !== 3 || !copy.every(unit)) throw new ModelStageRefusal(MODEL_COLOR_REFUSAL.color(name));
  return Object.freeze([copy[0], copy[1], copy[2]]);
}

export function modelColorOfHex(value: string, name: string): ModelColor {
  if (!HEX.test(value)) throw new ModelStageRefusal(MODEL_COLOR_REFUSAL.hex(name, value));
  const bits = Number.parseInt(value.slice(1), 16);
  return Object.freeze([(bits >> RED & BYTE) / BYTE, (bits >> GREEN & BYTE) / BYTE, (bits & BYTE) / BYTE]);
}
