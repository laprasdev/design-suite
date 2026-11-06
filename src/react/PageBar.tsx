import {forwardRef, type ReactNode} from 'react';
import {Bar, BarContents, type BarProps, type BarSlots} from './Bar.tsx';
import {Button, type ButtonProps} from './Button.tsx';
import {SegmentedControl, ICON_SEGMENT_VARIANT, type SingleSegmentProps,
  type SegmentValue} from './SegmentedControl.tsx';

/** Product data supplies the glyphs and destinations. */
export function HeaderNavigation<Value extends SegmentValue>(props: SingleSegmentProps<Value>) {
  return <nav className="app-bar-navigation" aria-label={props.ariaLabel}>
    <SegmentedControl {...props} iconOnly variant={ICON_SEGMENT_VARIANT}/>
  </nav>;
}


/** The full page header surface used by core. Applications own navigation and slot lifetimes. */
export const PageHeaderBar = forwardRef<HTMLElement, Omit<BarProps, 'as'>>(function PageHeaderBar(
  {className = '', ...props}, ref,
) {
  return <Bar {...props} as="header" data-page-bar="header" ref={ref} className={`app-bar ${className}`}/>;
});
export interface FooterAction extends Omit<ButtonProps, 'children'> {label: ReactNode}
export interface PageFooterProps extends Omit<BarProps, 'as' | 'slots'> {
  slots?: BarSlots;
  settings?: ReactNode;
  action?: FooterAction | null;
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
  {slots, settings, action, className = '', ...props}, ref,
) {
  return <Bar {...props} ref={ref} as="footer" data-page-bar="footer" className={`match-footer ${className}`}
    data-footer-action={!!action} slots={pageFooterSlots({slots, settings, action})}/>;
});
