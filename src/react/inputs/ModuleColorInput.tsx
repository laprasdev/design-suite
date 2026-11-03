import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, T } from '../../synth/design/index.ts';
import { useControlGesture } from '../../synth/components/synth/base/useControlBehavior.ts';
import { ModuleNumberInput } from './ModuleNumberInput.tsx';

const G = D.moduleGrid;

/**
 * A colour to pick. `hex` is what the browser's picker can show, and channels past 1 stay as written until a pick
 * replaces them. A pick, from focus to blur, is one undo step, as typing the alpha is.
 */
export function ModuleColorInput({ hex, alpha, onHex, onAlpha, ariaLabel, disabled }: {
  hex: string; alpha: number; onHex: (hex: string) => void; onAlpha: (alpha: number) => void; ariaLabel: string;
  disabled?: boolean;
}) {
  const style = useStyle().getEffectiveStyle();
  const gesture = useControlGesture();
  const swatchStyle: React.CSSProperties = {
    width: G.swatchWidth, height: G.swatchHeight, padding: 0, border: 'none', background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
  const alphaStyle: React.CSSProperties = {
    ...T.moduleValue, display: 'flex', alignItems: 'center', gap: G.groupGap, color: style.textColor,
  };
  return <div data-module-color style={{ display: 'grid', justifyItems: 'center', gap: G.groupGap }}>
    <input type="color" aria-label={ariaLabel} value={hex} disabled={disabled} onFocus={() => gesture.begin()}
      onBlur={() => gesture.end()} onChange={event => onHex(event.target.value)} style={swatchStyle} />
    <label title="Alpha" style={alphaStyle}>
      A<ModuleNumberInput ariaLabel={`${ariaLabel} alpha`} value={alpha} disabled={disabled} fill onChange={onAlpha} />
    </label>
  </div>;
}
