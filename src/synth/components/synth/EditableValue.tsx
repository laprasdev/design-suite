// A value that opens a box to type a number into: it writes the number, clamps it, or refuses it and says why.
import React, { useRef, useState } from 'react';
import { D } from '../../design/index.ts';
import {Modal} from '../../../react/Modal.tsx';
import {ModalPlacement} from '../../../react/modalElements.ts';
import {Label} from '../../../react/accents.tsx';
import {cancelsOnEscape} from '../../../react/controlCancel.ts';

/** What the value shows: its text, or the box being typed into. A refusal is the text with its words beside it. */
export const ValueShown = Object.freeze({ TEXT: 'text', EDITING: 'editing' } as const);
type Shown = typeof ValueShown[keyof typeof ValueShown] | { readonly refused: string };

const REFUSAL_INSET = D.moduleGrid.inputPadding;

/** What a refused number says: the limits it has, and that nothing was written. */
export function limitWords(typed: number, min: number, max: number) {
  const takes = Number.isFinite(min) && Number.isFinite(max) ? `${min} to ${max}`
    : Number.isFinite(min) ? `${min} or more` : `${max} or less`;
  return `Takes ${takes}, so ${typed} wasn't written.`;
}

/**
 * `refusesOutside` writes nothing for a number past min or max and says so, where without it the number is clamped.
 * Escape then leaves without writing.
 * `value` is the exact number held, where `text` may round it for show: the box opens holding it, and leaving the box
 * on that number writes nothing.
 * A refusal is an anchored Modal under the value, a Label: a press elsewhere, Escape or the next edit dismisses it.
 */
export function EditableValue({ text, value, color, style, onChange, min, max, refusesOutside, opensOnPress }: {
  text: string; value?: number; color: string; style: React.CSSProperties;
  onChange?: (v: number) => void; min: number; max: number; refusesOutside?: boolean;
  /** One press opens the box, as its text cursor promises. Without it, as on the old grid, a double-click does. */
  opensOnPress?: boolean;
}) {
  const [shown, setShown] = useState<Shown>(ValueShown.TEXT);
  const inputRef = useRef<HTMLInputElement>(null), box = useRef<HTMLDivElement>(null);
  const opensWith = value === undefined ? text.replace(/[^0-9.\-]/g, '') : String(value);
  const open = () => setShown(ValueShown.EDITING), leave = () => setShown(ValueShown.TEXT);

  const commit = () => {
    const typed = inputRef.current?.value ?? '';
    const raw = parseFloat(typed);
    leave();
    if (value !== undefined && (typed === opensWith || raw === value)) return;
    if (isNaN(raw)) return;
    if (refusesOutside && (raw < min || raw > max)) return setShown({ refused: limitWords(raw, min, max) });
    onChange?.(Math.min(max, Math.max(min, raw)));
  };
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') commit();
    else cancelsOnEscape(event, () => { if (!refusesOutside) return false; leave(); return true; });
  };

  if (shown !== ValueShown.EDITING || !onChange) return <div ref={box} data-editable-value style={style}
    onClick={opensOnPress ? open : undefined} onDoubleClick={opensOnPress ? undefined : open}>
    {text}
    {typeof shown === 'object' && <Modal open placement={ModalPlacement.ANCHORED} anchor={box}
      popover={{ align: 'center' }} onClose={leave} role="alert" style={{ padding: REFUSAL_INSET }}>
      <Label kind="action">{shown.refused}</Label>
    </Modal>}
  </div>;

  return (
    <input ref={inputRef} autoFocus defaultValue={opensWith}
      style={{ ...style, background: 'transparent', border: 'none', outline: 'none', color, width: 32, padding: 0 }}
      onBlur={commit} onKeyDown={onKey} />
  );
}
