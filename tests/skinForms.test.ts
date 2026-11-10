import test from 'node:test';
import assert from 'node:assert/strict';
import groups from '../src/react/gallery/elements.json' with {type: 'json'};
import {emptySkinAssignments, type ComponentSkin} from '../src/skinAssignments.ts';
import {skinForm, skinFormOrDefault} from '../src/skinForms.ts';
import {SkinDefault, SkinId, SkinKind, SliderSkinForm, ContainerForm, KnobSkinForm, RangeSkinForm, YesNoSkinForm,
  NumberSkinForm, ChoiceSkinForm, FlagsSkinForm, VectorSkinForm, OpensSkinForm, ColorSkinForm, TextSkinForm,
  LayersSkinForm, ReferenceSkinForm, CurveSkinForm, PhasesSkinForm, ReadoutSkinForm} from '../src/skinKinds.ts';
import {GalleryGroup, ModulationForm} from '../src/react/gallery/elementCatalog.ts';
import {GraphForm} from '../src/synth/components/synth/graphForm.ts';
import {IncrementerForm} from '../src/synth/components/synth/incrementerForm.ts';

const optionIds = (kind: string) => groups.find(group => group.id === kind)?.options.map(option => option.id);
const bare: ComponentSkin = {id: 'bare', name: 'Bare', candidates: {}, active: {}};

test('a skin naming no form resolves each defaulted kind to its default and skinForm stays undefined', () => {
  for (const {kind, form} of Object.values(SkinDefault)) {
    assert.equal(skinFormOrDefault(bare, {kind, form}), form);
    assert.equal(skinFormOrDefault(undefined, {kind, form}), form);
    assert.equal(skinForm(bare, kind), undefined);
  }
});

test('a skin that names a form wins over the default', () => {
  const named: ComponentSkin = {...bare, active: {[SkinKind.SLIDER]: SliderSkinForm.MINIMAL}};
  assert.equal(skinFormOrDefault(named, SkinDefault.SLIDER), SliderSkinForm.MINIMAL);
});

test('every default form is an option of its catalog group', () => {
  for (const {kind, form} of Object.values(SkinDefault)) assert.ok(optionIds(kind)?.includes(form), `${kind}/${form}`);
});

test('every seeded form is an option of its catalog group', () => {
  for (const skin of emptySkinAssignments().skins.filter(item => item.id !== SkinId.FREEFORM))
    for (const [kind, form] of Object.entries(skin.active))
      assert.ok(optionIds(kind)?.includes(form), `${skin.id}: ${kind}/${form}`);
});

test('the Flat skin draws the slider as a track', () => {
  const flat = emptySkinAssignments().skins.find(item => item.id === SkinId.FLAT);
  assert.equal(flat?.active[SkinKind.SLIDER], SliderSkinForm.TRACK);
});

test('the number kind\'s stepper and meter forms are the incrementer\'s own', () => {
  assert.equal(NumberSkinForm.HORIZONTAL, IncrementerForm.HORIZONTAL);
  assert.equal(NumberSkinForm.VERTICAL, IncrementerForm.VERTICAL);
  assert.equal(NumberSkinForm.METER, IncrementerForm.METER);
  assert.deepEqual(Object.values(GraphForm).sort(), (optionIds(GalleryGroup.GRAPH) ?? []).sort());
});

test('each kind\'s form owner lists exactly its catalog group\'s option ids', () => {
  const owners: Record<string, Record<string, string>> = {
    [SkinKind.KNOB]: KnobSkinForm, [SkinKind.SLIDER]: SliderSkinForm, [SkinKind.RANGE]: RangeSkinForm,
    [SkinKind.NUMBER]: NumberSkinForm, [SkinKind.YES_NO]: YesNoSkinForm, [SkinKind.CHOICE]: ChoiceSkinForm,
    [SkinKind.FLAGS]: FlagsSkinForm, [SkinKind.VECTOR]: VectorSkinForm, [SkinKind.COLOR]: ColorSkinForm,
    [SkinKind.TEXT]: TextSkinForm, [SkinKind.LAYERS]: LayersSkinForm, [SkinKind.REFERENCE]: ReferenceSkinForm,
    [SkinKind.CURVE]: CurveSkinForm, [SkinKind.PHASES]: PhasesSkinForm, [SkinKind.OPENS]: OpensSkinForm,
    [SkinKind.READOUT]: ReadoutSkinForm, [SkinKind.CONTAINER]: ContainerForm, [GalleryGroup.GRAPH]: GraphForm,
    [GalleryGroup.MODULATION]: ModulationForm,
  };
  for (const kind of Object.values(SkinKind)) assert.ok(owners[kind], `no form owner for ${kind}`);
  for (const [group, owner] of Object.entries(owners))
    assert.deepEqual([...Object.values(owner)].sort(), [...(optionIds(group) ?? [])].sort(), group);
});
