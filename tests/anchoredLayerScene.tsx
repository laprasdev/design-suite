// The page the anchored layer test measures: an anchored Modal from an element and one from a point, each rendered
// inside a box that clips what it holds (overflow hidden and paint containment) and much smaller than the Modal. The
// one from a point grows a frame after it opens, as a card does when its content changes.
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Modal} from '../src/react/index.ts';
import {ModalPlacement} from '../src/react/modalElements.ts';
import {AnchoredCase,CASE_ATTRIBUTE,CLIPPING_BOX,GROWN_ATTRIBUTE,OPENED_AT,PANEL_CASE_ATTRIBUTE}
 from './anchoredLayerCases.ts';
import {renderScene} from './renderScene.tsx';

const PASSAGE='An anchored panel far taller and wider than the box it is rendered in, which clips what it holds.';
const {widthPx,heightPx,gapPx}=CLIPPING_BOX;
const Clipping=({name,children}: {name: string;children: ReactNode})=><div {...{[CASE_ATTRIBUTE]:name}}
 style={{width:`${widthPx}px`,height:`${heightPx}px`,marginTop:`${gapPx}px`,overflow:'hidden',contain:'paint'}}>
 {children}
</div>;
function FromElement() {
 const anchor=useRef<HTMLSpanElement>(null);
 return <Clipping name={AnchoredCase.ELEMENT}><span ref={anchor}>Anchor</span>
  <Modal open placement={ModalPlacement.ANCHORED} anchor={anchor}
   {...{[PANEL_CASE_ATTRIBUTE]:AnchoredCase.ELEMENT}}>{PASSAGE}</Modal></Clipping>;
}

function FromPoint() {
 const [grown,setGrown]=useState(false);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setGrown(true));return()=>cancelAnimationFrame(frame);},[]);
 return <Clipping name={AnchoredCase.POINT}>
  <Modal open placement={ModalPlacement.ANCHORED} anchor={OPENED_AT}
   {...{[PANEL_CASE_ATTRIBUTE]:AnchoredCase.POINT}}>
   {PASSAGE}{grown&&<p {...{[GROWN_ATTRIBUTE]:''}}>{PASSAGE}</p>}
  </Modal>
 </Clipping>;
}

renderScene(<><FromElement/><FromPoint/></>);
