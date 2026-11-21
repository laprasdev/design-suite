// What the lead rows test renders (leadRowsScene.tsx) and measures: lead rows nested in an ends row's control, one
// with a track and its tool, and one with only its lead and its tool.
import {element} from '../src/react/elementContract.ts';

export const LeadRowsHost = element('lead-rows-host');
export const LEAD_ROWS = Object.freeze({width: 420, tool: 20, line: 'Lead'});
