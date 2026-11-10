import {forwardRef, type ReactNode} from 'react';
import {Bar, BarContents, type BarProps, type BarSlots} from './Bar.tsx';
import {Button, type ButtonProps} from './Button.tsx';
import {SegmentedControl, ICON_SEGMENT_VARIANT, type SingleSegmentProps,
  type SegmentValue} from './SegmentedControl.tsx';
import {HeaderIconButton} from './HeaderIconButton.tsx';
import {ActionNotice, type ActionBarNotice} from './ActionBar.tsx';
import {HeaderNoticesElement, PageHeaderFloatElement} from './pageBarElements.ts';

/** Product data supplies the glyphs and destinations, as in core's sport selector. */
export function HeaderNavigation<Value extends SegmentValue>(props: SingleSegmentProps<Value>) {
  return <nav className="app-bar-navigation" aria-label={props.ariaLabel}>
    <SegmentedControl {...props} iconOnly variant={ICON_SEGMENT_VARIANT}/>
  </nav>;
}
export function HeaderBrand({label, image, onHome}: {label: string; image?: string; onHome(): void}) {
  return <button type="button" className="app-bar-logo" aria-label={label} onClick={onHome}>
    {image && <img src={image} alt=""/>}<span className="app-bar-wordmark">{label}</span>
  </button>;
}
export function HeaderBack({onBack, label = 'Back'}: {onBack(): void; label?: string}) {
  return <HeaderIconButton label={label} onClick={onBack} bare>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="m15 6-6 6 6 6"/>
    </svg>
  </HeaderIconButton>;
}
export interface PageHeaderBarProps extends Omit<BarProps, 'as'> {
  back?: ReactNode; notice?: ActionBarNotice|null;
  /** At phone width the centre slot takes a row of its own under the left and right slots. */
  centerRow?: boolean;
  /** The notice floats over the page beneath the header, so it never moves what is below. */
  floatingNotice?: boolean;
  /** Content kept under the header, in either form of notice: the notice sits beneath it, covering none of it. */
  below?: ReactNode;
}

/** The full page header surface used by core. Applications own navigation and slot lifetimes. */
export const PageHeaderBar = forwardRef<HTMLElement, PageHeaderBarProps>(function PageHeaderBar(
  {className = '', slots, back, notice, centerRow, floatingNotice, below, ...props}, ref,
) {
  const header = <Bar {...props} as="header" data-page-bar="header" data-center-row={centerRow || undefined} ref={ref}
    className={`page-surface app-bar ${className}`} slots={{...slots,
      left: <>{back && <div className="app-bar-leading">{back}</div>}{slots.left}</>}}/>;
  if (!floatingNotice) return <>{header}{below}<ActionNotice notice={notice}/></>;
  return <div className={PageHeaderFloatElement.className}>{header}{below}
    <div className={HeaderNoticesElement.className}><ActionNotice notice={notice}/></div></div>;
});
export interface FooterAction extends Omit<ButtonProps, 'children'> {label: ReactNode}
export interface PageFooterProps extends Omit<BarProps, 'as' | 'slots'> {
  slots?: BarSlots;
  settings?: ReactNode;
  action?: FooterAction | null;
  /** At phone width the settings drop their labels, which stay as each control's hover hint. */
  compact?: boolean;
}
/** Persistent core surfaces and standalone pages use the same settings and proceed action. */
export function pageFooterSlots({slots, settings, action}: Pick<PageFooterProps, 'slots' | 'settings' | 'action'>) {
  const {label, className = '', ...button} = action ?? {};
  return {...slots, left: <>{settings && <div className="page-footer-settings">{settings}</div>}{slots?.left}</>,
    right: <>{slots?.right}{action && <Button {...button} variant="primary"
      className={`setup-footer-action ${className}`}>{label}</Button>}</>};
}
export function PageFooterContents(props: Pick<PageFooterProps, 'slots' | 'settings' | 'action'>) {
  return <BarContents {...pageFooterSlots(props)}/>;
}
export const PageFooter = forwardRef<HTMLElement, PageFooterProps>(function PageFooter(
  {slots, settings, action, compact, className = '', ...props}, ref,
) {
  return <Bar {...props} ref={ref} as="footer" data-page-bar="footer" className={`match-footer ${className}`}
    data-footer-action={!!action} data-footer-compact={compact || undefined}
    slots={pageFooterSlots({slots, settings, action})}/>;
});
