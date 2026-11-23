// Lead rows nested in a row's control fill it: each row's tool sits on its lead's line, every tool ends on the
// control's right edge, and a row with no track lays its lead across to its tool. Read in Chromium from
// leadRowsScene.tsx.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT, openScene, SCENE_GL} from './browserScene.ts';
import {LeadRowsHost} from './leadRowsCases.ts';

const page = await openScene('tests/leadRowsScene.tsx', DESKTOP_VIEWPORT, SCENE_GL.software);
const host = page.locator(LeadRowsHost.selector);
await host.locator('[data-field-tool]').first().waitFor();

const measure = () => host.evaluate((node: HTMLElement) => {
  const found = (within: Element, selector: string) => {
    const element = within.querySelector(selector);
    if (!element) throw new Error(`No ${selector} in the lead rows scene.`);
    return element;
  };
  const control = found(node, '[data-module-rows] [data-field-control]');
  const rows = [...control.querySelectorAll('[data-module-field]')].map(row => ({
    lead: found(row, '[data-field-lead]').getBoundingClientRect(),
    tool: found(row, '[data-field-tool]').getBoundingClientRect(),
    track: row.querySelector('[data-field-control]')?.getBoundingClientRect() ?? null,
  }));
  return {control: control.getBoundingClientRect().right, rows};
});

test('nested lead rows keep each tool on its line and every tool on the control edge', async () => {
  const {control, rows} = await measure();
  assert.equal(rows.length, 2);
  for (const [index, {lead, tool}] of rows.entries()) {
    assert.ok(Math.abs(tool.top - lead.top) < 1, `row ${index + 1}: the tool sits on its lead's line`);
    assert.ok(Math.abs(tool.right - control) < 1, `row ${index + 1}: the tool ends on the control's edge`);
  }
  const [withTrack, leadOnly] = rows;
  assert.ok(withTrack.track && Math.abs(leadOnly.lead.right - withTrack.track.right) < 1,
    'a row with no track lays its lead across to its tool');
});
