import {type SegmentOption} from '../SegmentedControl.tsx';
import {LayoutDimensions} from '../../layout.ts';
import {ICON_CLUSTER_BOX, ICON_GLYPH_SHARE} from './iconSizes.ts';
import {useTooltipSafe} from '../../synth/components/synth/TooltipContext.tsx';

const {iconChoiceBox} = LayoutDimensions.moduleGrid;
/** The grid's smallest cell: every option an icon in a square, the glyph its share of it, growing with the room. */
export const GRID_CELL = {cell: iconChoiceBox, glyphShare: ICON_GLYPH_SHARE, iconOnly: true} as const;
/** The icons form's cells, the same glyph share at the size the grid's icons reach in the smallest tile. */
export const ICONS_CELL = {cell: ICON_CLUSTER_BOX, glyphShare: ICON_GLYPH_SHARE, iconOnly: true} as const;
/** The size an icon takes in a pictured choice, in a row or a grid: the whole slot its form gives it. */
export const PICTURED_ICON_SIZE = '100%';

/** An option of a pictured choice: its icon, and the text the page hint shows while it is hovered or focused. */
export type PicturedOption = SegmentOption<number> & {hint?: string};

/** What every pictured form reports to the page hint: the text of the option pointed at, none once it leaves. */
export function usePointHint(options: readonly PicturedOption[]) {
  const {setTooltip} = useTooltipSafe();
  return (index: number|null) => setTooltip(index === null ? null : options[index]?.hint ?? null);
}
