import React, {forwardRef} from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import {hexToRgba} from '../../color.ts';
import {D, O} from '../../synth/design/index.ts';
import {Borders} from '../../tokens.ts';
import {MODULE_TEXT_SIZE} from '../../moduleGridLayout.ts';
import {ModulationPart} from './modulationParts.ts';

type SocketProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** The colours of what is assigned, one per source: none leaves the box empty, one fills it, several blend
   *  across it. */
  colors?: readonly string[]; size?: number;
  /** The socket's detail is open in place of what it sits over: its edge draws at full strength. */
  open?: boolean;
};

/** A fixed square assignment target, one per control however many sources it holds. The host owns source
 *  compatibility, drops and the chooser. */
export const ModulationSocket = forwardRef<HTMLButtonElement, SocketProps>(
  function ModulationSocket({colors = [], size = MODULE_TEXT_SIZE, open, style: extra, ...props}, ref) {
    const style = useStyle().getEffectiveStyle();
    const fills = colors.map(color => hexToRgba(color, O.medium));
    const background = fills.length > 1 ? `linear-gradient(90deg, ${fills.join(', ')})` : fills[0] ?? 'transparent';
    return <button {...props} ref={ref} type="button" {...{[ModulationPart.SOCKET]: true}}
      {...{[ModulationPart.ASSIGNED]: fills.length > 0 || undefined}}
      aria-expanded={open}
      style={{display: 'block', flex: '0 0 auto', width: size, height: size, padding: 0, boxSizing: 'border-box',
        border: `${Borders.standard.width}px ${Borders.standard.style} `
          + hexToRgba(style.primaryColor, open ? O.full : O.medium),
        borderRadius: D.radius.tiny, background, cursor: 'pointer', ...extra}}/>;
  });
