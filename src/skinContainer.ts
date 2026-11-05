import type {CSSProperties} from 'react';
import type {StyleTheme} from './synth/StyleTypes.ts';
import {containerCSS} from './synth/design/Composable.ts';
import {Borders} from './tokens.ts';

/** The same module frame in a sample and in the page shell; layout remains with the host. */
export function skinContainerCSS(style: StyleTheme, form: string): CSSProperties {
  if (form === 'flat') return {background: style.backgroundColor, border: 0,
    borderBottom: `${Borders.standard.width}px solid ${style.borderColor}`, borderRadius: 0, boxShadow: 'none'};
  const {padding, opacity, ...surface} = containerCSS(style.containers!.cutout);
  return surface;
}
