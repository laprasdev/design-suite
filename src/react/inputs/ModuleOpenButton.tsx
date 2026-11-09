import React from 'react';
import {Layers} from 'lucide-react';
import {skinForm} from '../../skinForms.ts';
import {OpensSkinForm, SkinKind} from '../../skinKinds.ts';
import {ModuleToolButton} from './ModuleToolButton.tsx';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { Borders } from '../../tokens.ts';
import { D, O, T } from '../../synth/design/index.ts';

const G = D.moduleGrid;

/** What marks something that opens: the skin's tool icon, or a chevron. */
export function OpensMark({ appearance, size }: { appearance?: string; size: number }) {
  const skin = useStyle().skin;
  return (appearance ?? skinForm(skin, SkinKind.OPENS)) === OpensSkinForm.TOOL ? <Layers size={size}/> : <>›</>;
}

/**
 * A field whose contents open in the module's body. Its mark is in the text colour, which still reads when its field is
 * dim.
 */
export function ModuleOpenButton({ ariaLabel, onPress, disabled, appearance }: {
  appearance?: string;
  ariaLabel: string; onPress: () => void; disabled?: boolean;
}) {
  const context = useStyle(), style = context.getEffectiveStyle();
  const tool = (appearance ?? skinForm(context.skin, SkinKind.OPENS)) === OpensSkinForm.TOOL;
  if (tool) return <ModuleToolButton label={ariaLabel}
    icon={<OpensMark appearance={OpensSkinForm.TOOL} size={G.toolIconHeight}/>} onPress={onPress} disabled={disabled}
    iconOnly/>;
  const buttonStyle: React.CSSProperties = {
    ...T.moduleLabel, width: G.openButtonWidth, height: G.openButtonHeight, padding: 0,
    border: `${Borders.standard.width}px ${Borders.standard.style} ${hexToRgba(style.primaryColor, O.low)}`,
    borderRadius: D.radius.button, background: 'transparent', color: style.textColor,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
  return <button type="button" data-field-open aria-label={ariaLabel} disabled={disabled} onClick={onPress}
    style={buttonStyle}><OpensMark appearance={appearance} size={G.toolIconHeight}/></button>;
}
