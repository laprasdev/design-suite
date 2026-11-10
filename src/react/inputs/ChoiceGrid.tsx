import React, {useRef} from 'react';
import {SegmentedControl, ICON_SEGMENT_VARIANT} from '../SegmentedControl.tsx';
import {useStyleThemeVariables} from '../styleTheme.ts';
import {useWrapColumns} from '../useWrapColumns.ts';
import {GRID_CELL, usePointHint, type PicturedOption} from './picturedParts.ts';

interface PicturedChoiceProps {
  options: readonly PicturedOption[]; selected: number; onChoose: (index: number) => void;
  ariaLabel: string; disabled: boolean;
}

/**
 * The choice kind's grid form: every option an icon in a square cell, in as many even rows as the width takes, filling
 * the frame. The chosen one is lit by the icons form's own selection, and the page hint names the option pointed at.
 */
export function ChoiceGrid({options, selected, onChoose, ariaLabel, disabled}: PicturedChoiceProps) {
  const theme = useStyleThemeVariables(), frame = useRef<HTMLDivElement|null>(null);
  const {cell, glyphShare, iconOnly} = GRID_CELL;
  const columns = useWrapColumns(frame, options.length, cell), point = usePointHint(options);
  return <SegmentedControl options={options} value={selected} onChange={onChoose} variant={ICON_SEGMENT_VARIANT}
    wrap={{frame, cell, columns}} glyphShare={glyphShare} onPoint={point}
    iconOnly={iconOnly} disabled={disabled} ariaLabel={ariaLabel} style={theme}/>;
}
