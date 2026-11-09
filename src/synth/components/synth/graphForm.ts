// One graph, two forms: drawn from a baseline at the bottom or from a centre line. A leaf, so the graph and the
// gallery's catalog share it without importing each other.
export const GraphForm = Object.freeze({UNIPOLAR: 'unipolar', BIPOLAR: 'bipolar'} as const);
export type GraphFormValue = typeof GraphForm[keyof typeof GraphForm];
