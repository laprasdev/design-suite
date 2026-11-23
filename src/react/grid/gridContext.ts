// What a module's grid tells the fields inside it: how big a knob is in its cells, and where a field sits in its cell.
import React, { useContext } from 'react';
import { D } from '../../synth/design/index.ts';

/** How big a knob is in a grid's cells. FilledModuleGrid provides it. */
export const ModuleControlSize = React.createContext<number>(D.moduleGrid.controlMin);
/** How big a knob is in this grid's cells. */
export const useModuleControlSize = () => useContext(ModuleControlSize);

// Where a field sits in its cell: centred in the rack's fixed cells, and on its column's line on a page, so names and
// dots line up from row to row.
export const FieldAlign = Object.freeze({ CENTER: 'center', START: 'start' } as const);
export type FieldAlignValue = typeof FieldAlign[keyof typeof FieldAlign];
/** Whether a grid's column holds a knob with its name and reading beside it rather than beneath: chosen by the room
 *  the column is given, so a narrow tile's one column lays a knob's caption to its right. FilledModuleGrid provides
 *  it. */
export const ModuleFieldBeside = React.createContext<boolean>(false);
/** Whether this grid's fields lay their captions beside their controls. */
export const useFieldBeside = () => useContext(ModuleFieldBeside);
/** Where a grid's fields sit in their cells. FilledModuleGrid provides it. */
export const ModuleFieldAlign = React.createContext<FieldAlignValue>(FieldAlign.CENTER);
/** Where this grid's fields sit in their cells. */
export const useFieldAlign = () => useContext(ModuleFieldAlign);
