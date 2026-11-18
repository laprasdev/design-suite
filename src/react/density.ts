/** How tightly a control sits. Compact draws a control's text at caption size, its spacing tighter, and its glyphs at
 *  its action label's size; every control that takes a density reads this one vocabulary. */
export const Density=Object.freeze({COMPACT:'compact'} as const);
export type Density=typeof Density[keyof typeof Density];
