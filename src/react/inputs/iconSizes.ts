import {LayoutDimensions, PHI} from '../../layout.ts';

const {iconChoiceBox, iconChoiceGlyph} = LayoutDimensions.moduleGrid;
/** The share of its cell an icon takes, in a grid and in a cluster alike. */
export const ICON_GLYPH_SHARE = iconChoiceGlyph / iconChoiceBox;
/** A few icons drawn together: φ above the grid's smallest cell, the size a grid's icons reach in the smallest tile. */
export const ICON_CLUSTER_BOX = iconChoiceBox * PHI;
