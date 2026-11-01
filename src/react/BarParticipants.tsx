import {useEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import {BarParticipantElement} from './actionBarElements.ts';
import {PositiveReaction,positiveReaction,PARTICIPANT_REACTION_MS,PARTICIPANT_WIGGLE,PARTICIPANT_WIGGLE_DEGREES,type PositiveReactionName} from './participantInteraction.ts';
import {reducedMotion} from './motion.ts';
import {PARTICIPANT_GRASS} from './participantGrass.ts';
import {useParticipantGrass} from './useParticipantGrass.ts';

export interface BarParticipant {
 id: string;
 name: string;
 imageUrl: string;
 color?: string;
 // Normalized visible bounds; ordinary portraits occupy the whole image.
 imageBottom?: number;
 imageHeight?: number;
}
// A decorative gathering. Sports pass their active participants; this component
// owns only their presentation, never roster selection or game randomness.
export function BarParticipants({participants,center,onInteract}: {participants: readonly BarParticipant[],center?: ReactNode,onInteract?(id: string): void}) {
 const root=useRef<HTMLDivElement>(null),grass=useParticipantGrass(root);
 const middle=Math.ceil(participants.length/2),groups=[participants.slice(0,middle),participants.slice(middle)];
 return <div ref={root} className={BarParticipantElement.ROOT.className} data-center={!!center||undefined}>
  {groups.map((group,side)=><div key={side} className={BarParticipantElement.GROUP.className} style={{'--participant-count':group.length} as CSSProperties}>
   {group.map((participant,index)=><ParticipantActor key={participant.id} participant={participant} index={index+side*middle} position={group.length===1?.5:index/(group.length-1)} onInteract={onInteract}/>)}
  </div>)}
  {center&&<div className={BarParticipantElement.MESSAGE.className}>{center}</div>}
  {participants.length>0&&<svg className={BarParticipantElement.GRASS.className} viewBox={`0 ${-PARTICIPANT_GRASS.height} ${grass.width} ${PARTICIPANT_GRASS.height}`} preserveAspectRatio="none" aria-hidden="true">
   {grass.blades.map((blade,index)=><g key={index} transform={`translate(${blade.x} 0)`}>
    <g className={BarParticipantElement.BLADE.className} style={{'--grass-variant':blade.variant} as CSSProperties}><path d={blade.path}/></g>
   </g>)}
  </svg>}
 </div>;
}
function ParticipantActor({participant,index,position,onInteract}: {participant: BarParticipant,index: number,position: number,onInteract?: (id: string)=>void}) {
 const [reaction,setReaction]=useState<{emotion: PositiveReactionName}|null>(null),image=useRef<HTMLImageElement>(null);
 useEffect(()=>{if(!reaction)return;const timer=setTimeout(()=>setReaction(null),PARTICIPANT_REACTION_MS);return()=>clearTimeout(timer);},[reaction]);
 const interact=()=>{
  setReaction({emotion:positiveReaction(Math.random)});onInteract?.(participant.id);
  if(!reducedMotion())image.current?.animate([0,-PARTICIPANT_WIGGLE_DEGREES,PARTICIPANT_WIGGLE_DEGREES,0].map(angle=>({transform:`rotate(${angle}deg)`})),PARTICIPANT_WIGGLE);
 };
 const emotion=reaction?.emotion??(index%2===0?PositiveReaction.SMILE:PositiveReaction.HEART);
 return <button type="button" className={BarParticipantElement.ACTOR.className} aria-label={`Rub ${participant.name}'s belly`} onClick={interact} data-reaction={reaction?true:undefined} style={{'--participant-position':position,'--participant-index':index,'--participant-color':participant.color,'--participant-image-bottom':participant.imageBottom??1,'--participant-image-height':participant.imageHeight??1} as CSSProperties}>
  <span className={BarParticipantElement.SPRITE.className}><img ref={image} src={participant.imageUrl} alt="" draggable={false}/></span>
  <svg className={BarParticipantElement.CHAT.className} viewBox="0 0 24 20" fill="none" aria-hidden="true">
   <path d="M2 2h20v13h-8l-4 4v-4H2Z" fill="var(--text)" stroke="var(--card)"/>
   {emotion===PositiveReaction.SMILE?<path d="M7 8V5h2v3m6 0V5h2v3M8 10h8l-2 3h-4Z" fill="var(--card)"/>:emotion===PositiveReaction.HEART?<path d="m7 6 3-1 2 2 2-2 3 1v3l-5 4-5-4Z" fill="var(--pink)"/>:<path d="M11 3h2v3h3v2h-3v4h-2V8H8V6h3ZM5 10h2v2H5Zm13-5h2v2h-2Z" fill="var(--pink)"/>}
  </svg>
 </button>;
}
