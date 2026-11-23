import type React from 'react';
import { D } from '../../synth/design/index.ts';
import { ONE_LINE_HEIGHT } from './lineTrack.ts';

/** A field on one line, what leads then its name, as tall as the line it presses on. A yes/no and a line field share
 *  it; its grid row sets its pitch. */
export const FIELD_LINE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: D.moduleGrid.fieldGap, maxWidth: '100%', minHeight: ONE_LINE_HEIGHT,
};
