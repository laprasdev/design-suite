import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {skinFrameCSS} from '../src/skinContainer.ts';
import type {ComponentSkin} from '../src/skinAssignments.ts';
import {ContainerForm, SkinKind} from '../src/skinKinds.ts';
import {SKIN_NAMES, skinPalette} from '../src/skins.ts';
import {skinStyle} from '../src/synth/skinStyle.ts';

const bare: ComponentSkin = {id: 'bare', name: 'Bare', candidates: {}, active: {}};
const flat: ComponentSkin = {...bare, active: {[SkinKind.CONTAINER]: ContainerForm.FLAT}};
const cutoutBorderWidth = (name: string) => skinStyle(name).containers?.cutout?.border?.width;

describe('module frame', () => {
  it('draws the skin\'s cutout border in its border colour where the skin names no container form', () => {
    for (const name of SKIN_NAMES) for (const skin of [undefined, bare]) {
      assert.equal(skinFrameCSS(skinStyle(name), skin).border,
        `${cutoutBorderWidth(name)}px solid ${skinPalette(name).border}`, name);
    }
  });

  it('draws the flat form in the skin\'s border colour', () => {
    for (const name of SKIN_NAMES) {
      const border = String(skinFrameCSS(skinStyle(name), flat).border);
      assert.ok(border.endsWith(`solid ${skinPalette(name).border}`), `${name}: ${border}`);
    }
  });
});
