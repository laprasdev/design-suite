// What the header glyph test renders (headerGlyphScene.tsx): each compact form of a header glyph, and each tone on
// each thing that wears one, every one named for the test to find.
import type {NoticeTone} from '../src/react/actionBarElements.ts';
export const CompactGlyph=Object.freeze({BAR:'compact bar',BUTTON:'compact button',CHOICE:'compact choice',
 TOGGLE:'compact toggle'} as const);
// A module header's controls in their header forms: a cycle showing one of its options, and an icon toggle whose
// glyph is what a press does next.
export const HeaderForm=Object.freeze({CYCLE:'header cycle',TOGGLE:CompactGlyph.TOGGLE} as const);
export const CYCLE_OPTIONS=Object.freeze(['One','Two','Three'] as const);
export const toneButton=(tone: NoticeTone)=>`${tone} button`;
export const toneIcon=(tone: NoticeTone)=>`${tone} icon`;
