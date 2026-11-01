import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createTheme} from '@looms/bloom-design';
import {Button,Cycle,Label,Modal,PlayerIcon} from '@looms/bloom-design/react';
import '@looms/bloom-design/react/styles.css';
import './gallery.css';

import {galleryCopy,themes} from './galleryContent.js';
function SamplePortrait(){
 return <svg viewBox="0 0 80 80" role="img" aria-label={galleryCopy.photo}><rect width="80" height="80" fill="#263b4c"/><circle cx="40" cy="28" r="15" fill="#e6c1a8"/><path d="M9 80c0-40 62-40 62 0" fill="#7ba5b4"/></svg>;
}
function Gallery(){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(false),[palette,setPalette]=useState(themes[0].value);
 const opener=useRef(null);
 const theme=createTheme({colors:{accent:themes.find(option=>option.value===palette).color}});
 const style=Object.fromEntries(Object.entries(theme.colors).map(([key,value])=>[
  `--color-${key.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`)}`,value,
 ]));
 return <main className="bloom-gallery" style={style}>
  <header><Label kind="name">Component Library</Label><h1>{galleryCopy.title}</h1><p>{galleryCopy.description}</p>
   <Cycle label={galleryCopy.theme} options={themes} value={palette} onChange={setPalette}/>
  </header>
  <div className="gallery-grid">
   <section><h2>Portraits</h2><p>Photos, badges, progress and status rings are supplied as props.</p>
    <div className="gallery-portraits">{[40,64,96].map(size=><PlayerIcon key={size} size={size} title={`${size}px Portrait`} photo={<SamplePortrait/>}
     ring={{pct:.75,label:galleryCopy.progress}} statusRings={[{id:'active',pct:.5,label:galleryCopy.status,color:theme.colors.teal}]} topLeft="12" topRight="20"/>)}</div>
    <PlayerIcon size={64} title={galleryCopy.portrait} photo={<SamplePortrait/>} selected={selected} onTap={()=>setSelected(value=>!value)}/>
    {selected&&<p role="status">{galleryCopy.selected}</p>}
   </section>
   <section><h2>Dialogs</h2><p>Focus stays inside a blocking dialog and returns to its opener.</p>
    <Button variant="primary" onClick={event=>{opener.current=event.currentTarget;setOpen(true);}}>{galleryCopy.open}</Button>
    <Button variant="ghost">{galleryCopy.outside}</Button>
   </section>
  </div>
  <Modal open={open} onClose={()=>setOpen(false)} blocking returnFocusRef={opener} ariaLabel={galleryCopy.dialog} className="gallery-dialog">
   <h2>{galleryCopy.dialog}</h2><label>{galleryCopy.field}<input defaultValue="Bloom Studio"/></label>
   <details><summary>{galleryCopy.details}</summary><p>This content expands inside the same dialog. Its held position keeps the disclosure under your pointer.</p></details>
   <Button variant="primary" onClick={()=>setOpen(false)}>{galleryCopy.close}</Button>
  </Modal>
 </main>;
}
createRoot(document.getElementById('root')).render(<Gallery/>);
