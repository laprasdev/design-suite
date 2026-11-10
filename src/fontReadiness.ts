import {DISPLAY_FONT_FAMILY} from './theme.ts';

export interface FontRequirement {readonly family: string; readonly weight: number}
export const INTERFACE_FONTS: readonly FontRequirement[] = Object.freeze(
 [400,500,600,700].map(weight => Object.freeze({family:DISPLAY_FONT_FAMILY,weight})),
);
export const FONT_LOAD_TIMEOUT_MS=15_000;
const requests=new WeakMap<FontFaceSet,Map<string,Promise<void>>>();
const familyName=(family: string)=>family.replace(/^[\"']|[\"']$/g,'').toLowerCase();
export const fontRequestKey=(requirements: readonly FontRequirement[])=>JSON.stringify(requirements);
function hasWeight(face: FontFace,weight: number) {
 const value=face.weight==='normal'?'400':face.weight==='bold'?'700':face.weight;
 const range=value.split(/\s+/).map(Number);
 return range.length===1?range[0]===weight:range.length===2&&weight>=range[0]&&weight<=range[1];
}
/** Load actual declared faces, never a successful fallback from FontFaceSet.check/load.
 * Failed CSS FontFaces cannot be retried in place: callers recover by reloading the document.
 */
export function loadFonts(requirements: readonly FontRequirement[],fonts: FontFaceSet=document.fonts) {
 let documentRequests=requests.get(fonts);
 if(!documentRequests){documentRequests=new Map();requests.set(fonts,documentRequests);}
 const key=fontRequestKey(requirements),existing=documentRequests.get(key);
 if(existing)return existing;
 const request=Promise.resolve().then(async()=>{
  const declared: FontFace[]=[],faces=new Set<FontFace>();
  fonts.forEach(face=>declared.push(face));
  for(const requirement of requirements){
   const matches=declared.filter(face=>familyName(face.family)===familyName(requirement.family)
    &&hasWeight(face,requirement.weight)&&face.style==='normal');
   if(!matches.length)throw new Error(`Required font is not declared: ${requirement.family} ${requirement.weight}`);
   matches.forEach(face=>faces.add(face));
  }
  let timer: ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_,reject)=>{
   timer=setTimeout(()=>reject(new Error('Interface fonts did not finish loading.')),FONT_LOAD_TIMEOUT_MS);
  });
  try {
   await Promise.race([Promise.all([...faces].map(face=>face.load())),timeout]);
   if([...faces].some(face=>face.status!=='loaded'))throw new Error('An interface font did not load.');
  } finally {clearTimeout(timer);}
 });
 documentRequests.set(key,request);
 return request;
}
