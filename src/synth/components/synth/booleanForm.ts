// One boolean, three forms: a lit cell for a module's grid, a labelled row for a settings list, or a small switch for a
// module's header. A leaf, so Boolean and the forms it draws share it without importing each other.
export const BooleanForm = Object.freeze({CELL: 'cell', SETTING: 'setting', SWITCH: 'switch'} as const);

export interface SwitchBooleanProps {
  form: typeof BooleanForm.SWITCH;
  value: boolean;
  onChange(value: boolean): void;
  ariaLabel: string;
  /** Its height. The width and thumb follow from it. */
  height?: number;
  disabled?: boolean;
}
