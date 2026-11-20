import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { D, O, T } from '../../synth/design/index.ts';

const { noticePadding } = D.moduleGrid;

/** How a module's notice sits in its room: a note under its controls, or an empty list's centred label. */
export const NoticeForm = Object.freeze({ NOTE: 'note', EMPTY: 'empty' } as const);
export type NoticeFormValue = typeof NoticeForm[keyof typeof NoticeForm];

/**
 * A sentence in a module saying what it can't do yet, or what limit applies. The empty form is a list with no entries:
 * one short label, faded and centred in the module's fixed room, which the entries replace.
 */
export function ModuleNotice({ form = NoticeForm.NOTE, children }: {
  form?: NoticeFormValue; children: React.ReactNode;
}) {
  const style = useStyle().getEffectiveStyle();
  if (form === NoticeForm.EMPTY) {
    return <div data-module-notice={NoticeForm.EMPTY} style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ ...T.moduleLabel, textTransform: 'uppercase', color: style.textColor, opacity: O.medium }}>
        {children}
      </span>
    </div>;
  }
  const noticeStyle: React.CSSProperties = {
    ...T.moduleValue, margin: 0, flexShrink: 0, padding: `0 ${noticePadding}px ${noticePadding}px`,
    color: hexToRgba(style.textColor, O.high),
  };
  return <p data-module-notice style={noticeStyle}>{children}</p>;
}
