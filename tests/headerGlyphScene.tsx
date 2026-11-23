// The page the header glyph and header form tests read in a browser: a glyph in each compact form, each tone on a
// button and on the notice's glyph, and a compact bar holding a cycle and an icon toggle in their header forms.
import {useState} from 'react';
import {Cycle,CycleForm} from '../src/react/Cycle.tsx';
import {Boolean,BooleanForm} from '../src/synth/components/synth/Boolean.tsx';
import {PauseIcon,PlayIcon} from '../src/react/PlaybackIcons.tsx';
import {ActionBar,NoticeIcon} from '../src/react/ActionBar.tsx';
import {HeaderIconButton,ResetIcon} from '../src/react/HeaderIconButton.tsx';
import {SegmentedControl,ICON_SEGMENT_VARIANT} from '../src/react/SegmentedControl.tsx';
import {Density} from '../src/react/density.ts';
import {NoticeTone} from '../src/react/actionBarElements.ts';
import {CompactGlyph,CYCLE_OPTIONS,HeaderForm,toneButton,toneIcon} from './headerGlyphCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
const GLYPHS={on:<PauseIcon/>,off:<PlayIcon/>};
const OPTIONS=CYCLE_OPTIONS.map(value=>({value,label:value}));
function HeaderForms() {
 const [option,setOption]=useState<string>(CYCLE_OPTIONS[0]),[on,setOn]=useState(false);
 return <ActionBar density={Density.COMPACT} slots={{right:<>
  <Cycle variant={CycleForm.TEXT} ariaLabel={HeaderForm.CYCLE} options={OPTIONS} value={option} onChange={setOption}/>
  <Boolean form={BooleanForm.ICON} label={HeaderForm.TOGGLE} value={on} onChange={setOn} glyphs={GLYPHS} bare
   density={Density.COMPACT}/>
  <HeaderIconButton label={CompactGlyph.BAR}><ResetIcon/></HeaderIconButton>
 </>}}/>;
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
