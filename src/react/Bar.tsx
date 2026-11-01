import {createElement,forwardRef,type HTMLAttributes,type ReactNode} from 'react';
import {BarElement,BarSlotElement} from './barElements.ts';

// Every chrome surface accepts the same explicit regions. Its variant owns
// geometry; a page supplies content without choosing a second layout path.
export interface BarSlots {left?: ReactNode;center?: ReactNode;right?: ReactNode;}
export interface BarProps extends Omit<HTMLAttributes<HTMLElement>,'children'> {
 as?: 'div'|'header'|'footer';
 slots: BarSlots;
}
// Persistent surfaces also use these regions when their contents arrive by portal.
export function BarContents({left,center,right}: BarSlots) {
 return <><div className={BarSlotElement.LEFT.className}>{left}</div><div className={BarSlotElement.CENTER.className}>{center}</div><div className={BarSlotElement.RIGHT.className}>{right}</div></>;
}
export const Bar=forwardRef<HTMLElement,BarProps>(function Bar({as='div',slots,className='',...props},ref) {
 return createElement(as,{...props,ref,className:`${BarElement.className}${className?` ${className}`:''}`},<BarContents {...slots}/>);
});
