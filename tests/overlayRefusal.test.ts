// Every overlay pattern is declared; one the suite does not draw yet is refused by name through the action notice,
// and a source asking for it is refused whole. Each case names its pattern as written, never as read from the table.
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {bundled} from './bundled.ts';

type Module = typeof import('../src/react/overlayFills.ts') & typeof import('../src/react/overlaySource.ts')
  & typeof import('../src/react/menuSource.ts');
type Source = import('../src/react/overlaySource.ts').OverlaySource;
type Element = import('../src/react/overlaySource.ts').OverlayElement;
type Fills = import('../src/react/overlayFills.ts').OverlayFills;
const {module, dispose} = await bundled<Module>(['src/react/overlayFills.ts', 'src/react/overlaySource.ts',
  'src/react/menuSource.ts']);
const {OVERLAY_FILLS, OverlaySlot, OverlayPattern, SidebarEdge, MenuRoot, MenuViewKind, MenuCellKind,
  overlayRefusal} = module;
after(dispose);

const ignore = () => undefined;
const DELEGATE = Object.freeze({select: ignore, activate: ignore, choose: ignore});
const FIRST = Object.freeze({section: 0, row: 0});
const PIPS = Object.freeze({value: 2, max: 3, segments: 3});
const COUNTED = Object.freeze({image: 'kind.png', count: 7});
const ROWS = [{key: 'only', rows: [{key: 'resume', cell: {kind: MenuCellKind.ACTION, label: 'Resume'}}]}];
const inSlot = (elements: readonly Element[]): Source => ({slots: {[OverlaySlot.TOP_START]: elements}});
const detail = (names: string) => `Overlay patterns not filled: ${names}.`;
// The pickup hint is the recent collectible preview, not an element, so its case is written apart from CASES.
const PICKUP_HINT_CASE = 'PickupHint';

const CASES: readonly (readonly [string, Source])[] = [
  ['HealthSpiral', inSlot([{kind: OverlayPattern.HEALTH_SPIRAL, ...PIPS}])],
  ['BreathMeter', inSlot([{kind: OverlayPattern.BREATH_METER, ...PIPS}])],
  ['CollectiblePreview', inSlot([{kind: OverlayPattern.COLLECTIBLE_PREVIEW, counted: COUNTED, recent: false}])],
  ['StatePeek', inSlot([{kind: OverlayPattern.STATE_PEEK, names: ['idle']}])],
  ['PIPCameraDisplay', inSlot([{kind: OverlayPattern.PIP_CAMERA, view: 'second'}])],
  ['Minimap', inSlot([{kind: OverlayPattern.MINIMAP, view: 'above'}])],
  ['DialogueDisplay', inSlot([{kind: OverlayPattern.DIALOGUE, title: 'Speaker', lines: ['A line.']}])],
  ['Tooltip', inSlot([{kind: OverlayPattern.TOOLTIP, text: 'Jump'}])],
  ['GamePadPreview', inSlot([{kind: OverlayPattern.GAMEPAD_PREVIEW, pressed: ['south']}])],
  ['ProjectileTarget', {world: [{kind: OverlayPattern.PROJECTILE_TARGET, image: 'aim.png', position: [0, 1, 2]}]}],
  ['SidebarFullNestedCollection', {sidebars: {[SidebarEdge.START]: {
    groups: [{key: 'group', label: 'Group', sections: ROWS}], group: 0, selected: FIRST,
    delegate: {...DELEGATE, selectGroup: ignore}}}}],
  ['collection', {menu: {root: MenuRoot.PAUSE, stack: [{kind: MenuViewKind.COLLECTION, key: 'pause', title: 'Pause',
    sections: ROWS, selected: FIRST}], delegate: DELEGATE}}],
  ['synth', {menu: {root: MenuRoot.PAUSE, stack: [{kind: MenuViewKind.SYNTH, key: 'synth'}], delegate: DELEGATE}}],
];

describe('overlay refusal', () => {
  it('writes a case for every declared pattern', () => {
    assert.deepEqual(new Set([...CASES.map(([name]) => name), PICKUP_HINT_CASE]),
      new Set(Object.values(OverlayPattern)));
  });

  for (const [name, source] of CASES) {
    it(`refuses an unfilled ${name} by name`, () => {
      assert.deepEqual(overlayRefusal(source, OVERLAY_FILLS),
        {message: 'Not filled', tone: 'error', detail: detail(name)});
    });
  }

  it(`refuses an unfilled ${PICKUP_HINT_CASE} by name, beside the preview it is drawn with`, () => {
    const fills: Fills = {...OVERLAY_FILLS,
      [OverlayPattern.COLLECTIBLE_PREVIEW]: element => String(element.counted.count)};
    const recent = inSlot([{kind: OverlayPattern.COLLECTIBLE_PREVIEW, counted: COUNTED, recent: true}]);
    assert.deepEqual(overlayRefusal(recent, fills),
      {message: 'Not filled', tone: 'error', detail: detail(PICKUP_HINT_CASE)});
  });

  it('asks nothing of an empty source', () => {
    assert.equal(overlayRefusal({}, OVERLAY_FILLS), null);
  });

  it('refuses a source whole, naming each unfilled pattern once, in order', () => {
    const source: Source = {slots: {[OverlaySlot.BOTTOM]: [{kind: OverlayPattern.TOOLTIP, text: 'Jump'}],
      [OverlaySlot.TOP_START]: [{kind: OverlayPattern.HEALTH_SPIRAL, ...PIPS},
        {kind: OverlayPattern.HEALTH_SPIRAL, ...PIPS}]}};
    assert.equal(overlayRefusal(source, OVERLAY_FILLS)?.detail, detail('HealthSpiral, Tooltip'));
  });

  it('draws a filled pattern and refuses only the unfilled one beside it', () => {
    const fills: Fills = {...OVERLAY_FILLS, [OverlayPattern.BREATH_METER]: element => String(element.value)};
    assert.equal(overlayRefusal(inSlot([{kind: OverlayPattern.BREATH_METER, ...PIPS}]), fills), null);
    assert.equal(overlayRefusal(inSlot([{kind: OverlayPattern.BREATH_METER, ...PIPS},
      {kind: OverlayPattern.MINIMAP, view: 'above'}]), fills)?.detail, detail('Minimap'));
  });
});
