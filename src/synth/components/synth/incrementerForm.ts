// One integer control, four forms: chevrons that step it up and down or left and right, a row of pips to pick from,
// or (by the stepper form) a typed field between them. A leaf, so the control and the skin kinds share it.
export const IncrementerForm = Object.freeze({
  STEPPER: 'stepper', METER: 'meter', VERTICAL: 'vertical', HORIZONTAL: 'horizontal',
} as const);
export type StepperDirection = typeof IncrementerForm.VERTICAL | typeof IncrementerForm.HORIZONTAL;
