// A page grid's knobs step one φ down from 88 px at its widest column, take φ⁻¹ of a mid column, stop one φ step
// lower at its narrowest, never change with height, and leave spare height to growing rows alone.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT, openScene, SCENE_GL} from './browserScene.ts';
import {FILLED_GRID, FILLED_GRID_CASES, FilledGridCell, FilledGridHost} from './filledGridCases.ts';

const page = await openScene('tests/filledGridScene.tsx', DESKTOP_VIEWPORT, SCENE_GL.software);
const hosts = page.locator(FilledGridHost.selector);
await hosts.first().waitFor();

interface Probe {width: number; height: number; cell: string}
interface Measured {size: number; knobWidth: number; rows: number[]}
const measureAt = (width: number, height: number) => hosts.evaluateAll(
  (nodes: HTMLElement[], {width, height, cell}: Probe) => {
    for (const node of nodes) {
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }
    return new Promise<Measured[]>(done => requestAnimationFrame(() => requestAnimationFrame(() => done(
      nodes.map(node => ({
        size: Number(node.querySelector('[data-module-grid]')?.getAttribute('data-control-size')),
        knobWidth: Math.round(
          node.querySelector('[data-control-anchor="radial"]')?.getBoundingClientRect().width ?? 0),
        rows: [...node.querySelectorAll(cell)].map(row => row.getBoundingClientRect().height),
      }))))));
  }, {width, height, cell: FilledGridCell.selector});

test('a page grid steps its knob on φ across column widths', async () => {
  for (const {name, width, knob} of FILLED_GRID.widths) {
    const measured = await measureAt(width, FILLED_GRID.heights[0]);
    FILLED_GRID_CASES.forEach((gridCase, index) => {
      assert.equal(measured[index].size, knob, `${gridCase.name} (${name}): data-control-size`);
      assert.equal(measured[index].knobWidth, knob, `${gridCase.name} (${name}): rendered knob width`);
    });
  }
});

test('a taller grid keeps its control size, and only growing rows take the height', async () => {
  const {width, knob} = FILLED_GRID.widths[0];
  const short = await measureAt(width, FILLED_GRID.heights[0]);
  const tall = await measureAt(width, FILLED_GRID.heights[1]);
  FILLED_GRID_CASES.forEach(({name, growRows}, index) => {
    assert.equal(short[index].size, knob, `${name}: short control size`);
    assert.equal(tall[index].size, short[index].size, `${name}: tall control size`);
    assert.equal(tall[index].knobWidth, knob, `${name}: tall rendered knob width`);
    tall[index].rows.forEach((height, row) => growRows.includes(row + 1)
      ? assert.ok(height > short[index].rows[row], `${name}: row ${row + 1} grows`)
      : assert.equal(height, FILLED_GRID.cellHeight, `${name}: row ${row + 1} keeps its content's height`));
  });
});
