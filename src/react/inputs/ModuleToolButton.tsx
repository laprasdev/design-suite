import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { D, O, T } from '../../synth/design/index.ts';

/**
 * An icon and its name that opens something. Dim when this case doesn't use it, and quiet when nothing is set in it,
 * and it still opens either way.
 */
export function ModuleToolButton({ label, icon, title, dim, set, onPress, disabled, iconOnly }: {
  disabled?: boolean; iconOnly?: boolean;
  label: string; icon: React.ReactNode; title?: string; dim?: boolean; set?: boolean; onPress: () => void;
}) {
  const style = useStyle().getEffectiveStyle();
  const buttonStyle: React.CSSProperties = {
    ...T.moduleLabel, display: 'grid', justifyItems: 'center', gap: D.moduleGrid.fieldGap, padding: 0, minWidth: 0,
    border: 'none', background: 'transparent', cursor: 'pointer', textTransform: 'uppercase',
    color: set ? style.primaryColor : hexToRgba(style.textColor, O.high), opacity: dim ? O.medium : O.full,
  };
  return <button type="button" data-module-tool={label} data-tool-used={!dim} data-tool-set={set}
    title={title ?? (iconOnly ? label : undefined)}
    aria-label={label} disabled={disabled} onClick={onPress} style={buttonStyle}>
    {icon}{!iconOnly && <span style={{ overflowWrap: 'anywhere' }}>{label}</span>}
  </button>;
}
