import {useEffect,useState,type RefObject} from 'react';
import {PARTICIPANT_GRASS,PARTICIPANT_GRASS_BEND,growParticipantGrass,participantGrassBend,type GrassBlade} from './participantGrass.ts';
import {BarParticipantElement as E} from './actionBarElements.ts';

// Plants the field to the bar's width, then samples existing CSS travel; no second
// clock drives the participants. Layout reads are batched before writes, and
// hidden/reduced-motion bars do no work.
export function useParticipantGrass(root:RefObject<HTMLDivElement|null>) {
 const [field,setField]=useState<{width:number,blades:readonly GrassBlade[]}>({width:0,blades:[]});
 useEffect(()=>{
  const bar=root.current;if(!bar)return;
  const observer=new ResizeObserver(([entry])=>{
   const {width}=entry.contentRect;
   setField(({blades})=>({width,blades:growParticipantGrass(blades,width,Math.random)}));
  });
  observer.observe(bar);return()=>observer.disconnect();
 },[root]);
 useEffect(()=>{
  const bar=root.current;if(!bar)return;
  const actors=Array.from(bar.querySelectorAll<HTMLElement>(E.ACTOR.selector));
  const blades=Array.from(bar.querySelectorAll<SVGGElement>(E.BLADE.selector));
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,timer:ReturnType<typeof setTimeout>|undefined,previous:number[]=[];
  const bends=blades.map(()=>0);
  const clear=()=>{
   clearTimeout(timer);previous=[];
   blades.forEach((blade,index)=>{blade.style.removeProperty(PARTICIPANT_GRASS_BEND);bends[index]=0;});
  };
  const sample=()=>{
   const bounds=bar.getBoundingClientRect(),now=performance.now();
   const boxes=actors.map(actor=>actor.getBoundingClientRect());
   if(!bounds.width){clear();return;}
   const contacts=boxes.map((box,index)=>{
    const position=box.left+box.width/2-bounds.left;
    const distance=previous[index]===undefined?0:position-previous[index];
    return {position,radius:box.width*PARTICIPANT_GRASS.contactRadius,
     speed:Math.abs(distance)<PARTICIPANT_GRASS.motionThreshold?0:distance/(now-lastSample)*1000};
   });
   previous=boxes.map(box=>box.left+box.width/2-bounds.left);lastSample=now;
   blades.forEach((blade,index)=>{
    const bend=participantGrassBend(field.blades[index].x,contacts);
    if(bend!==bends[index]){blade.style.setProperty(PARTICIPANT_GRASS_BEND,`${bend}deg`);bends[index]=bend;}
   });
   timer=setTimeout(sample,PARTICIPANT_GRASS.sampleMs);
  };
  let lastSample=performance.now();
  const sync=()=>{clear();if(visible&&!document.hidden&&!motion.matches)sample();};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
  observer.observe(bar);motion.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  return()=>{clear();observer.disconnect();motion.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);};
 });
 return field;
}
