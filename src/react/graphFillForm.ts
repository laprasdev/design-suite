// A graph fill's two forms: the curve as drawn, and lit, the part of it that is running now. A leaf, so the fill and
// the gallery's catalog share it without importing each other.
export const GraphFillForm = Object.freeze({PLAIN: 'plain', LIT: 'lit'} as const);
export type GraphFillFormValue = typeof GraphFillForm[keyof typeof GraphFillForm];
