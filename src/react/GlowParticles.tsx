import type {CSSProperties} from 'react';
import {GlowParticleElement} from './loadingElements.ts';

// [left %, top %, size px, delay s] for each particle.
const PARTICLES=[[14,65,2.5,0],[27,27,3.5,-1.2],[44,78,2,-.6],[62,18,2.8,-1.8],[82,56,4,-.9],[72,87,2,-2.2],[8,38,1.8,-1.6]];
const PROMINENT_PARTICLES=[...PARTICLES,[8,12,2,-.3],[22,88,3,-1.5],[36,48,2.2,-2.6],[51,10,2.8,-.8],[68,44,3,-2.1],[92,24,2.5,-1.1],[90,80,3.2,-2.8],[2,76,2,-1.9],[18,43,2.4,-3.1],[40,20,2.6,-2.4],[52,92,3,-1.7],[76,8,2,-3.4],[96,52,2.7,-.5],[59,64,2.2,-2.9]];
const PARTICLE_DURATION=2.1,PARTICLE_STAGGER=.19;

// Deterministic decorative particles rising around small artwork: no timers, layout changes or random markup.
// They glow in --glow-color.
export function GlowParticles({className='',prominent=false}: {className?: string,prominent?: boolean}) {
 const particles=prominent?PROMINENT_PARTICLES:PARTICLES;
 return <span className={`${GlowParticleElement.className} ${className}`} data-prominent={prominent} aria-hidden="true">
  {particles.map(([x,y,size,delay],i)=><i key={i} style={{left:`${x}%`,top:`${y}%`,'--particle-size':`${size}px`,'--particle-delay':`${delay}s`,'--particle-duration':`${PARTICLE_DURATION+i*PARTICLE_STAGGER}s`} as CSSProperties}/>)}
 </span>;
}
