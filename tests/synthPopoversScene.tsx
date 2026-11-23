// The page the synth popover test reads: a value that refuses a number past its limits and a cycling Enum, each in a
// box the test finds it by, on the suite's default theme and the synth's default skin, which nothing persists.
import {useState} from 'react';
import {createTheme} from '../src/theme.ts';
import {EditableValue} from '../src/synth/components/synth/EditableValue.tsx';
import {Enum} from '../src/synth/components/synth/Enum.tsx';
import {StyleProvider} from '../src/synth/StyleContext.tsx';
import {ENUM_OPTIONS,SynthPopoverElement,VALUE_LIMITS} from './synthPopoversCases.ts';
import {renderScene} from './renderScene.tsx';

const {min,max,held}=VALUE_LIMITS;
function Value() {
 const [value,setValue]=useState<number>(held);
 return <div className={SynthPopoverElement.VALUE.className}>
  <EditableValue text={String(value)} value={value} color={createTheme().colors.text} style={{}} onChange={setValue}
   min={min} max={max} refusesOutside opensOnPress/>
 </div>;
}
function Choice() {
 const [value,setValue]=useState(ENUM_OPTIONS[0].value);
 return <div className={SynthPopoverElement.ENUM.className}>
  <Enum variant="cycling" options={[...ENUM_OPTIONS]} value={value} onChange={setValue}/>
 </div>;
}

renderScene(<StyleProvider persist={false}>
 <div style={{display:'flex',gap:48,padding:120}}><Value/><Choice/></div>
</StyleProvider>);
