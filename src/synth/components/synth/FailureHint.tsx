import type {CSSProperties, ReactNode} from 'react';
import {NoticeIcon, type ActionBarNotice} from '../../../react/ActionBar.tsx';
import {ICON_STROKE} from '../../../react/HeaderIconButton.tsx';
import {WithTooltip} from './TooltipContext.tsx';

/** What failed in a word or two, and the whole of what happened: a notice's message and detail, both as text, as the
 *  hover hint over what a failure marks says them. */
export type Failure = {readonly [Part in 'message'|'detail']-?: Extract<ActionBarNotice[Part],string>};

/** The marker on a failed element, for checks; it adds no box of its own. */
const MARKER: CSSProperties = {display: 'contents'};
/** A glyph drawn at the text size around it. */
const TEXT_SIZE = '1em';

/** The glyph that marks an element whose failure has no icon of its own to colour, at its text's size. */
export const FailureGlyph = () => <NoticeIcon tone="error" size={TEXT_SIZE} strokeWidth={ICON_STROKE}/>;

/** The element a failure marks, laid out in `box`: with the pointer over it, the hover hint says what failed, then
 *  what happened. Unmarked, it is only the element. */
export function FailureHint({failure, box, children}: {
  failure: Failure | null; box: CSSProperties; children: ReactNode;
}) {
  return failure
    ? <WithTooltip tooltip={`${failure.message}: ${failure.detail}`} style={box}>
      <span data-failed style={MARKER}>{children}</span>
    </WithTooltip>
    : <>{children}</>;
}
