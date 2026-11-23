// What the header glyph test renders (headerGlyphScene.tsx): each compact form of a header glyph, and each tone on
// each thing that wears one, every one named for the test to find.
import type {NoticeTone} from '../src/react/actionBarElements.ts';
export const CompactGlyph=Object.freeze({BAR:'compact bar',BUTTON:'compact button',CHOICE:'compact choice',
 TOGGLE:'compact toggle'} as const);
// A module header's controls: the module's title heading a choice of its options, the last unavailable, and an icon
// toggle whose glyph, marked with which it is, is what a press does next.
export const HeaderForm=Object.freeze({TITLE:'Header',TOGGLE:CompactGlyph.TOGGLE} as const);
export const TITLE_OPTIONS=Object.freeze([{value:'one',label:'One'},{value:'two',label:'Twelve'},
 {value:'three',label:'Franchise 2D',unavailable:'Franchise 2D is not built yet.'}] as const);
export const TOGGLE_GLYPH_ATTRIBUTE='data-toggle-glyph';
export const ToggleGlyph=Object.freeze({ON:'on',OFF:'off'} as const);
export const toneButton=(tone: NoticeTone)=>`${tone} button`;
export const toneIcon=(tone: NoticeTone)=>`${tone} icon`;
