import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { D, O, T, TransitionKeys } from '../../synth/design/index.ts';
import { FieldEmphasis, type FieldEmphasisValue } from '../../fields.ts';
import { FieldAlign, type FieldAlignValue } from './gridContext.ts';

const G = D.moduleGrid;
/** How strongly a field's control reads in each emphasis. */
export const CONTROL_OPACITY: Record<FieldEmphasisValue, number> = { set: O.full, quiet: O.medium, inert: O.medium };

/** `rowTall` gives a pressable name the whole height of its row and at least a label's width, where it would
 *  otherwise be only its letters. */
interface FieldNameProps {
  label: string; icon?: React.ReactNode; emphasis: FieldEmphasisValue; onName?: () => void; nameLabel?: string;
  nameTitle?: string; align?: FieldAlignValue; rowTall?: boolean;
}
export function FieldName({ label, icon, emphasis, onName, nameLabel, nameTitle, align = FieldAlign.CENTER,
  rowTall }: FieldNameProps) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  const nameStyle: React.CSSProperties = {
    ...T.moduleLabel, display: 'inline-flex', alignItems: 'center', justifyContent: align, gap: G.nameIconGap,
    textTransform: 'uppercase', textAlign: align, transition: TransitionKeys.fast,
    color: set ? style.primaryColor : hexToRgba(style.textColor, O.high) };
  const content = <>{icon}{label}</>;
  const pressable: React.CSSProperties = { ...nameStyle, padding: 0, border: 'none', background: 'transparent',
    cursor: 'pointer', ...(rowTall && { minHeight: G.yesNoLine, minWidth: G.rowLabelWidth }) };
  return onName && !inert
    ? <button type="button" data-field-name aria-label={nameLabel} title={nameTitle} onClick={onName}
      style={pressable}>{content}</button>
    : <span data-field-name style={nameStyle}>{content}</span>;
}
