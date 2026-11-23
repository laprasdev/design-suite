// The page the header glyph and header form tests read in a browser: a glyph in each compact form, each tone on a
// button and on the notice's glyph, a compact bar holding an icon toggle, whose notice says why a title's choice was
// refused, and a module whose title heads a choice.
import {useState} from 'react';
import {Boolean,BooleanForm} from '../src/synth/components/synth/Boolean.tsx';
import {StyleProvider} from '../src/synth/StyleContext.tsx';
import {GridModule} from '../src/react/module/GridModule.tsx';
import type {ListboxOption} from '../src/react/ListboxSelect.tsx';
import {ActionBar,NoticeIcon} from '../src/react/ActionBar.tsx';
import {HeaderIconButton,ResetIcon} from '../src/react/HeaderIconButton.tsx';
import {SegmentedControl,ICON_SEGMENT_VARIANT} from '../src/react/SegmentedControl.tsx';
import {Density} from '../src/react/density.ts';
import {NoticeTone} from '../src/react/actionBarElements.ts';
import {CompactGlyph,HeaderForm,TITLE_OPTIONS,TOGGLE_GLYPH_ATTRIBUTE,ToggleGlyph,toneButton,toneIcon}
 from './headerGlyphCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
const glyph=(which: string)=><svg viewBox="0 0 2 2" aria-hidden="true" {...{[TOGGLE_GLYPH_ATTRIBUTE]:which}}>
 <rect width="2" height="2" fill="currentColor"/></svg>;
const GLYPHS={on:glyph(ToggleGlyph.ON),off:glyph(ToggleGlyph.OFF)};
type TitleOption=ListboxOption<typeof TITLE_OPTIONS[number]['value']>;
function HeaderForms() {
 const [value,setValue]=useState<TitleOption['value']>(TITLE_OPTIONS[0].value),[on,setOn]=useState(false);
 const [refused,setRefused]=useState<TitleOption|null>(null);
 return <StyleProvider persist={false}>
  <ActionBar density={Density.COMPACT}
   notice={refused&&{tone:NoticeTone.INFO,message:refused.label,detail:refused.unavailable}} slots={{right:<>
   <Boolean form={BooleanForm.ICON} label={HeaderForm.TOGGLE} value={on} onChange={setOn} glyphs={GLYPHS} bare
    density={Density.COMPACT}/>
   <HeaderIconButton label={CompactGlyph.BAR}><ResetIcon/></HeaderIconButton>
  </>}}/>
  <GridModule title={HeaderForm.TITLE} choice={{options:TITLE_OPTIONS,value,onChange:setValue,onRefuse:setRefused}}>
   {null}</GridModule>
 </StyleProvider>;
}
renderScene(<>
 <HeaderForms/>
 <HeaderIconButton bare density={Density.COMPACT} label={CompactGlyph.BUTTON}><ResetIcon/></HeaderIconButton>
 <SegmentedControl variant={ICON_SEGMENT_VARIANT} density={Density.COMPACT} iconOnly ariaLabel={CompactGlyph.CHOICE}
  value="one" options={[{value:'one',label:<ResetIcon/>,ariaLabel:'one'}]} onChange={ignore}/>
 {Object.values(NoticeTone).map(tone=><span key={tone}>
  <HeaderIconButton label={toneButton(tone)} tone={tone}><ResetIcon/></HeaderIconButton>
  <span role="img" aria-label={toneIcon(tone)}><NoticeIcon tone={tone}/></span>
 </span>)}
</>);
