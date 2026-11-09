import type React from 'react';
import { D } from '../../synth/design/index.ts';

/** A field on one line as high as a yes/no line, what leads then its name. A yes/no and a line field share it. */
export const FIELD_LINE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: D.moduleGrid.fieldGap,
  maxWidth: '100%', minHeight: D.moduleGrid.yesNoLine,
};
