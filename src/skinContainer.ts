import type {CSSProperties} from 'react';
import type {StyleTheme} from './synth/StyleTypes.ts';
import {containerCSS, type HciDataComposable} from './synth/design/Composable.ts';
import {Borders} from './tokens.ts';
import {D} from './synth/design/index.ts';
import type {ComponentSkin} from './skinAssignments.ts';
import {skinForm} from './skinForms.ts';
import {ContainerForm, containerFormOf, SkinKind, type ContainerFormValue} from './skinKinds.ts';

const cutoutOf = (style: StyleTheme) => {
  const cutout = style.containers?.cutout;
  if (!cutout) throw new Error('The style declares no cutout container.');
  return cutout;
};
const cutoutWidth = (cutout: HciDataComposable) => {
  const width = cutout.border?.width ?? cutout.edge?.width;
  if (width === undefined) throw new Error('The style\'s cutout declares no border width.');
  return width;
};
/** The same module frame in a sample and in the page shell; layout remains with the host. */
export function skinContainerCSS(style: StyleTheme, form: ContainerFormValue): CSSProperties {
  const cutout = cutoutOf(style);
  const width = form === ContainerForm.FLAT ? Borders.standard.width : cutoutWidth(cutout);
  const {padding, opacity, ...surface} = form === ContainerForm.FLAT
    ? {background: style.backgroundColor, border: `${width}px solid ${style.borderColor}`,
      borderRadius: D.radius.cutout, boxShadow: 'none', padding: undefined, opacity: undefined}
    : containerCSS(cutout);
  // Both forms keep the same longhands: removing one after a shorthand resets that edge in React.
  return {...surface, borderTopWidth: surface.borderTopWidth ?? width,
    borderRightWidth: surface.borderRightWidth ?? width, borderBottomWidth: surface.borderBottomWidth ?? width,
    borderLeftWidth: surface.borderLeftWidth ?? width};
}
/** The module frame under a style and skin: the skin's form, or the page's own frame where it names none. */
export const skinFrameCSS = (style: StyleTheme, skin: ComponentSkin | undefined): CSSProperties => {
  const form = skinForm(skin, SkinKind.CONTAINER);
  return form ? skinContainerCSS(style, containerFormOf(form)) : {background: style.cutoutBackground,
    border: `${Borders.standard.width}px solid ${style.cutoutBorder}`, borderRadius: D.radius.cutout};
};
