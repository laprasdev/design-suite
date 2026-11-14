// One slider, several forms: a bare track for a module's grid (cell, or thin), a labelled row with its written value
// and a reset (setting), a two-ended range, or progress. A leaf, so the synth Slider and the setting slider it draws
// share it without importing each other.
export const SliderForm = Object.freeze({
  CELL: 'cell', THIN: 'thin', SETTING: 'setting', RANGE: 'range', PROGRESS: 'progress',
} as const);
