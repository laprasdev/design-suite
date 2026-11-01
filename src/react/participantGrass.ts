// Decorative header grass: pixels across, SVG units up. It's planted at random
// along the whole bar, so each visit grows a different field.
export const PARTICIPANT_GRASS=Object.freeze({
 height:12,variants:7,
 gap:[1,3] as const,bladeHeight:[5,11] as const,lean:[-2,2] as const,baseWidth:[.6,.9] as const,
 sampleMs:120,contactRadius:.25,motionThreshold:.08,fullBendSpeed:4,bendDegrees:38,
});
export const PARTICIPANT_GRASS_BEND='--participant-grass-bend';
export interface GrassBlade {x:number;path:string;variant:number}
type Random=()=>number;
const between=(random:Random,[low,high]:readonly [number,number])=>low+random()*(high-low);
const coordinate=(value:number)=>Number(value.toFixed(2));
function plantBlade(x:number,random:Random):GrassBlade {
 const height=between(random,PARTICIPANT_GRASS.bladeHeight),lean=between(random,PARTICIPANT_GRASS.lean),base=between(random,PARTICIPANT_GRASS.baseWidth);
 return {
  x:coordinate(x),
  path:`M${coordinate(-base/2)} 0 Q${coordinate(-base)} ${coordinate(-height*.55)} ${coordinate(lean)} ${coordinate(-height)} Q${coordinate(lean*.25)} ${coordinate(-height*.45)} ${coordinate(base/2)} 0Z`,
  variant:Math.floor(random()*PARTICIPANT_GRASS.variants),
 };
}
// Only ever adds blades, so resizing the window never replants what's already growing.
export function growParticipantGrass(blades:readonly GrassBlade[],width:number,random:Random):readonly GrassBlade[] {
 let x=blades.at(-1)?.x??0;
 if(x>=width)return blades;
 const grown=[...blades];
 while(x<width){x+=between(random,PARTICIPANT_GRASS.gap);grown.push(plantBlade(x,random));}
 return grown;
}
export interface GrassContact {position:number;radius:number;speed:number}
export function participantGrassBend(position:number,contacts:readonly GrassContact[]) {
 const {fullBendSpeed,bendDegrees}=PARTICIPANT_GRASS;
 const force=contacts.reduce((sum,contact)=>{
  const proximity=Math.max(0,1-Math.abs(position-contact.position)/contact.radius);
  return sum+proximity*Math.max(-1,Math.min(1,contact.speed/fullBendSpeed));
 },0);
 // Blades extend upward (negative SVG y), so a negative skew follows rightward travel.
 return -Math.round(Math.max(-1,Math.min(1,force))*bendDegrees);
}
