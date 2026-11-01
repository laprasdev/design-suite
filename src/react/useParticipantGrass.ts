import {useEffect,type RefObject} from 'react';
import {PARTICIPANT_GRASS,PARTICIPANT_GRASS_BEND,participantGrass,participantGrassBend} from './participantGrass.ts';
import {BarParticipantElement as E} from './actionBarElements.ts';

// Sample existing CSS travel; no second clock drives the participants. Layout
// reads are batched before writes, and hidden/reduced-motion bars do no work.
export function useParticipantGrass(root:RefObject<HTMLDivElement|null>) {
 useEffect(()=>{
  const group=root.current;if(!group)return;
  const actors=Array.from(group.querySelectorAll<HTMLElement>(E.ACTOR.selector));
  const blades=Array.from(group.querySelectorAll<SVGGElement>(E.BLADE.selector));
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,timer:ReturnType<typeof setTimeout>|undefined,previous:number[]=[];
  const bends=blades.map(()=>0);
  const clear=()=>{
   clearTimeout(timer);previous=[];
   blades.forEach((blade,index)=>{blade.style.removeProperty(PARTICIPANT_GRASS_BEND);bends[index]=0;});
  };
  const sample=()=>{
   const bounds=group.getBoundingClientRect(),now=performance.now();
   const boxes=actors.map(actor=>actor.getBoundingClientRect());
   if(!bounds.width){clear();return;}
   const scale=PARTICIPANT_GRASS.width/bounds.width;
   const contacts=boxes.map((box,index)=>{
    const position=box.left+box.width/2-bounds.left;
    const distance=previous[index]===undefined?0:position-previous[index];
    return {position:position*scale,radius:box.width*PARTICIPANT_GRASS.contactRadius*scale,
     speed:Math.abs(distance)<PARTICIPANT_GRASS.motionThreshold?0:distance/(now-lastSample)*1000};
   });
   previous=boxes.map(box=>box.left+box.width/2-bounds.left);lastSample=now;
   blades.forEach((blade,index)=>{
    const bend=participantGrassBend(participantGrass[index].x,contacts);
    if(bend!==bends[index]){blade.style.setProperty(PARTICIPANT_GRASS_BEND,`${bend}deg`);bends[index]=bend;}
   });
   timer=setTimeout(sample,PARTICIPANT_GRASS.sampleMs);
  };
  let lastSample=performance.now();
  const sync=()=>{clear();if(visible&&!document.hidden&&!motion.matches)sample();};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
  observer.observe(group);motion.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  return()=>{clear();observer.disconnect();motion.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);};
 });
}
