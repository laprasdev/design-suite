import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {describe, it} from 'node:test';
import {
  baseSkin, deepMerge, DEFAULT_SKIN, designTokens, flattenSkin, resolveDesignSystem, resolveSkin,
  SELECTABLE_SKINS, SKIN_FILES, SKIN_NAMES,
} from '../src/skins.ts';
import {skinStyle} from '../src/synth/skinStyle.ts';
import {Typography} from '../src/tokens.ts';

const SKINS_FOLDER = new URL('../unity/Runtime/Resources/SharedSchema/Design/Synth/Skins/', import.meta.url);
const REQUIRED_COLORS = ['primary', 'secondary', 'background', 'backgroundGradient', 'text', 'border', 'outline',
  'glow', 'inactive', 'cutoutBackground', 'cutoutBorder', 'knobGradient'];
const flatSkin = (name: string) => flattenSkin(resolveDesignSystem(name));

describe('skin files', () => {
  it('registers every skin file in the folder', () => {
    const onDisk = readdirSync(SKINS_FOLDER).filter(file => file.endsWith('.skin.json'))
      .map(file => file.replace('.skin.json', '')).sort();
    assert.deepEqual(Object.keys(SKIN_FILES).sort(), onDisk);
  });

  it('resolves every skin through the base skin without a cycle', () => {
    for (const name of SKIN_NAMES) assert.ok(resolveSkin(name).forms && resolveSkin(name).structure, name);
  });

  it('rejects an unknown skin', () => assert.throws(() => resolveSkin('missing'), /Unknown skin/));

  it('bloom is the default, ahead of every other skin', () => {
    assert.equal(DEFAULT_SKIN, 'bloom');
    assert.equal(SKIN_NAMES[1], 'serum');
  });

  it('every selectable skin is complete, so nothing falls back to another skin', () => {
    assert.deepEqual(SELECTABLE_SKINS.map(skin => skin.name), ['bloom', 'serum', 'analog', 'midnight', 'neon', 'promethium']);
    for (const {name} of SELECTABLE_SKINS) {
      const flat = flatSkin(name);
      for (const color of REQUIRED_COLORS) assert.ok(flat.get(`forms.base.palette.${color}`), `${name} ${color}`);
      assert.equal(flat.get('forms.components.cycle.palette.border'), flat.get('forms.base.palette.primary'), name);
    }
  });

  it('every skin shares the one page grid and surface scale', () => {
    for (const name of SKIN_NAMES) {
      const flat = flatSkin(name);
      assert.equal(flat.get('structure.grid.columns'), 6, name);
      assert.equal((flat.get('structure.grid.rowFlex') as number[]).length, 6, name);
      assert.equal(flat.get('forms.base.variants.Selected.palette.primary'), '#fafafa', name);
      assert.equal(flat.get('forms.components.divider.palette.border'), 'rgba(250,250,250,0.09)', name);
      assert.equal(flat.get('forms.components.slider.variants.None.opacity.value'), 1, name);
    }
  });
});

describe('merging', () => {
  it('a child overrides values and keeps the rest of its parent', () => {
    const merged = deepMerge({a: 1, b: {c: 2, d: 3}}, {a: 10, b: {c: 20}, e: 5});
    assert.deepEqual(merged, {a: 10, b: {c: 20, d: 3}, e: 5});
  });

  it('arrays replace instead of joining', () => {
    assert.deepEqual(deepMerge({list: [1, 2, 3]}, {list: [10, 20]}).list, [10, 20]);
  });

  it('flattening keeps arrays as single values', () => {
    const flat = flattenSkin({a: {b: [1, 2], c: 3}});
    assert.deepEqual(flat.get('a.b'), [1, 2]);
    assert.equal(flat.get('a.c'), 3);
  });
});

describe('the design system', () => {
  it('holds the tokens and the skin together', () => {
    const flat = flatSkin('serum');
    assert.equal(flat.get('relativity.phi'), designTokens.relativity.phi);
    assert.equal(flat.get('forms.base.palette.primary'), '#33A9A8');
    assert.equal(flatSkin('midnight').get('forms.base.palette.primary'), '#5b9aff');
  });

  it('keeps the base skin\'s settings on every skin', () => {
    const flat = flatSkin('serum');
    assert.equal(flattenSkin(baseSkin).get('settings.displayMode.default'), 'cutout');
    assert.equal(flat.get('settings.displayMode.default'), 'cutout');
    assert.equal(flat.get('settings.enumStyle.default'), 'sharedBack');
    assert.equal(flat.get('settings.enumGlowMode.default'), 'glow');
    assert.equal(flat.get('settings.buttonWidth.default'), 'consistent');
    assert.equal(flat.get('settings.graphGrid.x.enabled'), true);
    assert.equal(flat.get('settings.graphGrid.opacity'), 0.5);
    assert.equal(flat.get('settings.casing.default'), 'allCapitals');
  });

  it('resolves type tiers to the suite\'s typography', () => {
    const flat = flatSkin('serum');
    const sizes = flat.get('forms.text.sizeScale') as number[];
    const baseIndex = flat.get('forms.text.sizeIndex') as number;
    const tiers = ['title', 'label', 'value', 'small', 'tiny', 'micro'] as const;
    for (const tier of tiers) {
      const index = Math.max(0, baseIndex + (flat.get(`forms.text.tiers.${tier}.sizeAdj`) as number));
      assert.equal(sizes[index], Typography[tier].fontSize, tier);
    }
  });
});

describe('the web view of a skin', () => {
  it('reads colors from the skin file', () => {
    const style = skinStyle('analog');
    assert.equal(style.name, 'Analog Warmth');
    assert.equal(style.primaryColor, '#ff8c42');
    assert.equal(style.secondaryColor, '#ffd700');
    assert.equal(style.backgroundColor, '#1a1410');
    assert.equal(style.textColor, '#fafafa');
    assert.deepEqual(style.knobGradient, ['#3a2f25', '#3a2818']);
  });

  it('keeps each skin\'s cutout shadow', () => {
    assert.equal(skinStyle('serum').shadowStyle, 'inset 0px 2px 8px rgba(0, 0, 0, 0.6), 0px 1px 0px rgba(255, 255, 255, 0.05)');
    assert.equal(skinStyle('neon').shadowStyle, 'inset 0px 2px 12px rgba(0, 0, 0, 0.9), 0px 0px 8px rgba(0, 255, 159, 0.15)');
  });

  it('gives a structure-only skin the default skin\'s colors', () => {
    assert.equal(skinStyle('flat').primaryColor, skinStyle(DEFAULT_SKIN).primaryColor);
    assert.equal(skinStyle('flat').name, 'flat');
  });

  it('builds module and cutout containers', () => {
    for (const {name} of SELECTABLE_SKINS) {
      assert.ok(skinStyle(name).containers?.module, name);
      assert.ok(skinStyle(name).containers?.cutout, name);
    }
  });
});
