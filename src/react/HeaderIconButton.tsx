import {forwardRef, type ButtonHTMLAttributes, type ReactNode} from 'react';
import {createLucideIcon, type IconNode, type LucideProps} from 'lucide-react';
import {PHI_INVERSE} from '../layout.ts';

// Navigation artwork fills the same square canvas, including its stroke. The
// drawings share a weight and natural bounds; CSS never stretches a glyph.
const NAVIGATION_SIDE = 24, NAVIGATION_STROKE = 1.5;
const navigationEdge = NAVIGATION_STROKE / 2, navigationCenter = NAVIGATION_SIDE / 2;
const navigationFrame = {x:String(navigationEdge),y:String(navigationEdge),
 width:String(NAVIGATION_SIDE - NAVIGATION_STROKE),height:String(NAVIGATION_SIDE - NAVIGATION_STROKE)};
// The same fine default as Gear/SidePanel, with normal SVG props and refs intact.
function navigationIcon(name: string, shapes: IconNode) {
 const Icon = createLucideIcon(name, shapes);
 return forwardRef<SVGSVGElement, LucideProps>(function NavigationIcon(props, ref) {
  return <Icon strokeWidth={NAVIGATION_STROKE} {...props} ref={ref}/>;
 });
}
export const CodeIcon = navigationIcon('Code', [
 ['rect', {...navigationFrame,rx:'3',key:'frame'}],
 ['path', {d:'m9 7-5 5 5 5m6-10 5 5-5 5',key:'brackets',
  transform:`translate(${navigationCenter} ${navigationCenter}) scale(${PHI_INVERSE}) `+
   `translate(${-navigationCenter} ${-navigationCenter})`}],
]);
export const ServerIcon = navigationIcon('Server', [
 ['rect', {...navigationFrame,height:String(9 - navigationEdge),rx:'2',key:'upper'}],
 ['rect', {...navigationFrame,y:'15',height:String(9 - navigationEdge),rx:'2',key:'lower'}],
 ['path', {d:'M5 5h.01M5 19h.01',key:'lights'}],
]);
export const LibraryIcon = navigationIcon('Library', [
 ['rect', {...navigationFrame,width:String(6 - navigationEdge),rx:'1',key:'first'}],
 ['rect', {...navigationFrame,x:'9',width:'5',rx:'1',key:'second'}],
 ['rect', {...navigationFrame,x:'17',width:String(NAVIGATION_SIDE - navigationEdge - 17),rx:'1',key:'third'}],
 ['path', {d:`M${navigationEdge} 6H6M9 18h5M17 6H${NAVIGATION_SIDE - navigationEdge}`,key:'spines'}],
]);

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
