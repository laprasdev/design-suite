// The page the header glyph test reads in a browser: a glyph in each compact form, and each tone on a button and on
// the notice's glyph.
import {ActionBar,NoticeIcon} from '../src/react/ActionBar.tsx';
import {HeaderIconButton,ResetIcon} from '../src/react/HeaderIconButton.tsx';
import {SegmentedControl,ICON_SEGMENT_VARIANT} from '../src/react/SegmentedControl.tsx';
import {Density} from '../src/react/density.ts';
import {NoticeTone} from '../src/react/actionBarElements.ts';
import {CompactGlyph,toneButton,toneIcon} from './headerGlyphCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
renderScene(<>
 <ActionBar density={Density.COMPACT} slots={{
  right:<HeaderIconButton label={CompactGlyph.BAR}><ResetIcon/></HeaderIconButton>,
 }}/>
 <HeaderIconButton bare density={Density.COMPACT} label={CompactGlyph.BUTTON}><ResetIcon/></HeaderIconButton>
 <SegmentedControl variant={ICON_SEGMENT_VARIANT} density={Density.COMPACT} iconOnly ariaLabel={CompactGlyph.CHOICE}
  value="one" options={[{value:'one',label:<ResetIcon/>,ariaLabel:'one'}]} onChange={ignore}/>
 {Object.values(NoticeTone).map(tone=><span key={tone}>
  <HeaderIconButton label={toneButton(tone)} tone={tone}><ResetIcon/></HeaderIconButton>
  <span role="img" aria-label={toneIcon(tone)}><NoticeIcon tone={tone}/></span>
 </span>)}
</>);
