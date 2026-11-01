// Decorative header grass, in SVG units. Repeating variants keep the planting
// even while varying the height, lean and shade of neighboring blades.
export const PARTICIPANT_GRASS=Object.freeze({
 width:256,height:12,count:64,baseWidth:1.4,
 heights:[6,9,7,11,8,5,10],leans:[-3,2,4,-1,-4,3,1],
 sampleMs:120,contactRadius:.38,motionThreshold:.08,fullBendSpeed:8,bendDegrees:38,
});
export const PARTICIPANT_GRASS_BEND='--participant-grass-bend';
export const participantGrass=Array.from({length:PARTICIPANT_GRASS.count},(_,index)=>{
 const {width,count,heights,leans,baseWidth}=PARTICIPANT_GRASS;
 const height=heights[index%heights.length],lean=leans[index%leans.length];
 return {
  x:(index+.5)*width/count,
  path:`M${-baseWidth/2} 0 Q${-baseWidth} ${-height*.55} ${lean} ${-height} Q${lean*.25} ${-height*.45} ${baseWidth/2} 0Z`,
  variant:index%heights.length,
 };
});
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
