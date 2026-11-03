import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { Borders } from '../../tokens.ts';
import { D, O, T } from '../../synth/design/index.ts';

const G = D.moduleGrid;

/**
 * A field whose contents open in the module's body. Its mark is in the text colour, which still reads when its field is
 * dim.
 */
export function ModuleOpenButton({ ariaLabel, onPress, disabled }: {
  ariaLabel: string; onPress: () => void; disabled?: boolean;
}) {
  const style = useStyle().getEffectiveStyle();
  const buttonStyle: React.CSSProperties = {
    ...T.moduleLabel, width: G.openButtonWidth, height: G.openButtonHeight, padding: 0,
    border: `${Borders.standard.width}px ${Borders.standard.style} ${hexToRgba(style.primaryColor, O.low)}`,
    borderRadius: D.radius.button, background: 'transparent', color: style.textColor,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
  return <button type="button" data-field-open aria-label={ariaLabel} disabled={disabled} onClick={onPress}
    style={buttonStyle}>›</button>;
}
