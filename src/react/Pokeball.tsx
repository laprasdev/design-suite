import type {CSSProperties,ReactNode,SVGProps} from 'react';
import {GlowParticles} from './GlowParticles.tsx';
import {GlowParticleElement,LoadingElement} from './loadingElements.ts';

export const POKEBALL_OUTLINE=Object.freeze({center:20,radius:13,buttonRadius:4.5});
// One outline serves the icon and anything drawn as a ball, like a pitch's centre circle. The button's fill masks the
// stripe; the caller supplies its surface colour.
export function PokeballOutline({cx=POKEBALL_OUTLINE.center,cy=POKEBALL_OUTLINE.center,radius=POKEBALL_OUTLINE.radius,buttonFill='var(--bg)',...props}: SVGProps<SVGGElement>&{cx?: number,cy?: number,radius?: number,buttonFill?: string}) {
 return <g {...props}><circle cx={cx} cy={cy} r={radius}/><path d={`M${cx-radius} ${cy}h${radius*2}`}/><circle cx={cx} cy={cy} r={radius*POKEBALL_OUTLINE.buttonRadius/POKEBALL_OUTLINE.radius} fill={buttonFill}/></g>;
}

// The Poké Ball. Fitted artwork fills its slot; otherwise it keeps the standard padded grid.
export function PokeballIcon({className='',fit=false,...props}: SVGProps<SVGSVGElement>&{fit?: boolean}) {
 return <svg className={`${LoadingElement.ICON.className} ${className}`} viewBox={fit?'6 6 28 28':'0 0 40 40'} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" {...props}><path d="M7 20a13 13 0 0 1 26 0Z" fill="currentColor" opacity=".24" stroke="none"/><PokeballOutline/></svg>;
}

// The ball thrown, spinning and settling with a burst: the loading animation, also usable as artwork.
const BURST_DIRECTIONS=8;
export function PokeballSpinner({size,fit=false}: {size?: number,fit?: boolean}) {
 return <span className={LoadingElement.POKEBALL.className} style={size?{'--loading-size':`${size}px`} as CSSProperties:undefined} aria-hidden="true">
  <GlowParticles/>
  <span className={`${GlowParticleElement.className} ${LoadingElement.BURST.className}`}>{Array.from({length:BURST_DIRECTIONS},(_,i)=><i key={i} style={{'--burst-angle':`${i*360/BURST_DIRECTIONS}deg`} as CSSProperties}/>)}</span>
  <PokeballIcon fit={fit}/>
 </span>;
}

// Loading where it happens: inside a widget or beside the thing that's coming.
export function LoadingIndicator({children='Loading…',className='',size=28}: {children?: ReactNode,className?: string,size?: number}) {
 return <span className={`${LoadingElement.INDICATOR.className} ${className}`} role="status">
  <PokeballSpinner size={size}/>
  <span>{children}</span>
 </span>;
}

// Loading a whole page: the indicator centred in the window.
export function LoadingScreen({children,size}: {children?: ReactNode,size?: number}) {
 return <div className={LoadingElement.SCREEN.className}><LoadingIndicator size={size}>{children}</LoadingIndicator></div>;
}
