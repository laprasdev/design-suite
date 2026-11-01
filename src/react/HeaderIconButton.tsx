import type {ButtonHTMLAttributes,ReactNode} from 'react';

// A header's square icon control. `active` marks the panel or mode it holds open.
export function HeaderIconButton({label,active=false,children,className='',...rest}: ButtonHTMLAttributes<HTMLButtonElement>&{label: string,active?: boolean,children: ReactNode}) {
 return <button type="button" {...rest} className={`header-icon-button${className?` ${className}`:''}`} aria-label={label} aria-pressed={active} title={label} data-active={active||undefined}>{children}</button>;
}
// The gear's teeth meet the ring without a second, heavier stroke.
export const GearIcon=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="5.8"/><circle cx="12" cy="12" r="2.3"/><path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21M5.64 5.64l2.26 2.26M16.1 16.1l2.26 2.26M5.64 18.36l2.26-2.26M16.1 7.9l2.26-2.26"/></svg>;
// A panel opening along the right edge.
export const SidePanelIcon=()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M15 4.5v15"/></svg>;
// Back to the default.
export const ResetIcon=()=><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 6.5A5 5 0 1 1 3 9"/><path d="M3 3v3.5h3.5"/></svg>;
