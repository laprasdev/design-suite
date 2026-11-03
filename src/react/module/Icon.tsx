import React from 'react';
import { D } from '../../synth/design/index.ts';

const SIZE_ATTRIBUTES = /\s(width|height)="[^"]*"/g;
const WHITE = /#fff|\bwhite\b/g;

/** Recolours an icon's own file by the text colour around it. */
export function Icon({ svg, height = D.moduleGrid.iconHeight, flip, label }: {
  svg: string; height?: number; flip?: boolean; label?: string;
}) {
  const shape = `<svg height="${height}" style="display:block;${flip ? 'transform:scaleX(-1)' : ''}" `;
  const sized = svg.replace(SIZE_ATTRIBUTES, '').replace('<svg ', shape).replace(WHITE, 'currentColor');
  const style: React.CSSProperties = { display: 'inline-block', lineHeight: 0 };
  const role = label ? 'img' : undefined;
  return <span role={role} aria-label={label} style={style} dangerouslySetInnerHTML={{ __html: sized }} />;
}
