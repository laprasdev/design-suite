// What the header glyph test renders (headerGlyphScene.tsx): each compact form of a header glyph, and each tone on
// each thing that wears one, every one named for the test to find.
import type {NoticeTone} from '../src/react/actionBarElements.ts';
export const CompactGlyph=Object.freeze({BAR:'compact bar',BUTTON:'compact button',CHOICE:'compact choice'} as const);
export const toneButton=(tone: NoticeTone)=>`${tone} button`;
export const toneIcon=(tone: NoticeTone)=>`${tone} icon`;
