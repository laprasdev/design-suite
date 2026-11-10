import {useEffect,useState} from 'react';
import {fontRequestKey,INTERFACE_FONTS,loadFonts,type FontRequirement} from '../fontReadiness.ts';

interface FontResult {key: string; error: Error|null}
/** A changed requirement set is pending immediately; stale completions cannot reveal its children. */
export function useFontReadiness(requirements: readonly FontRequirement[]=INTERFACE_FONTS) {
 const key=fontRequestKey(requirements),[result,setResult]=useState<FontResult|null>(null);
 useEffect(()=>{
  let active=true;
  const required: FontRequirement[]=JSON.parse(key);
  loadFonts(required).then(()=>{if(active)setResult({key,error:null});},failure=>{
   if(active)setResult({key,error:failure instanceof Error?failure:new Error('Interface fonts are unavailable.')});
  });
  return()=>{active=false;};
 },[key]);
 const current=result?.key===key?result:null;
 return {ready:current!==null&&current.error===null,error:current?.error??null};
}
