// The synth controls whose anchored Modals the synth popover test opens (synthPopoversScene.tsx): a value that refuses
// a number past its limits, and a cycling Enum whose picker opens above it.
import {element} from '../src/react/elementContract.ts';

export const SynthPopoverElement=Object.freeze({VALUE:element('synth-scene-value'),ENUM:element('synth-scene-enum')});
export const VALUE_LIMITS=Object.freeze({min:0,max:10,held:5});
export const ENUM_OPTIONS=Object.freeze(['Sine','Square','Saw','Noise']
 .map(name=>Object.freeze({value:name,label:name})));
